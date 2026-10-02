import fs from 'fs/promises';
import { fileTypeFromFile } from 'file-type';
import { pdf as renderPdf } from 'pdf-to-img';
import { Sample, ERROR_CATEGORIES } from '../models/sample.js';
import { Student } from '../models/student.js';
import { runAnalysis, getConfidenceThreshold } from '../services/errorClassificationEngine.js';

// Real accepted formats, matching the upload modal's copy ("JPG, PNG or PDF
// only"). Combined in from aadi/sample-upload: multer's own mimetype/
// extension checks are trivial to spoof, so every upload is re-verified
// against its actual file content once it lands on disk.
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

// One raster page ready to become a Sample.pages[] entry. JPG/PNG files are
// already exactly one page; a PDF may be several, so it is rendered to one
// PNG per page - a therapist scanning a single worksheet and a multi-page
// essay both end up with the "right" imageCount either way.
async function toPageFiles(file) {
  const detected = await fileTypeFromFile(file.path).catch(() => null);
  if (!detected || !ACCEPTED_MIME_TYPES.includes(detected.mime)) {
    const error = new Error(
      `"${file.originalname}" is not a supported file. Only JPG, PNG and PDF are accepted.`
    );
    error.statusCode = 422;
    throw error;
  }

  if (detected.mime !== 'application/pdf') {
    return [{ path: file.path, originalFilename: file.originalname }];
  }

  let rendered;
  try {
    const document = await renderPdf(file.path, { scale: 2 });
    rendered = [];
    for await (const page of document) rendered.push(page);
  } catch {
    const error = new Error(`"${file.originalname}" could not be read as a PDF.`);
    error.statusCode = 422;
    throw error;
  }

  const pages = await Promise.all(
    rendered.map(async (buffer, index) => {
      const pagePath = `${file.path}-p${index}.png`;
      await fs.writeFile(pagePath, buffer);
      return { path: pagePath, originalFilename: file.originalname };
    })
  );
  // The original PDF is kept on disk too (imagePath entries below only
  // reference the rendered pages) - harmless, and useful if a future
  // screen wants the source document rather than the split raster pages.
  return pages;
}

// ------------------------------------------------------------------
// Serialising samples for the client
// ------------------------------------------------------------------
// A sample document holds filesystem paths (pages[].imagePath), and the
// project rule is that raw paths NEVER leave the server (see AGENTS.md).
// So every route in this file answers with this shape instead of the raw
// Mongoose document. The field names are the ones the client already uses
// (client/src/lib/api.js).
//
// One mapper, not two: the review screen re-renders itself from whatever a
// PATCH hands back, so the writes have to answer with exactly what the read
// does. Splitting a "summary" off for the list routes only bought them a few
// hundred error objects they ignore, at the cost of a second copy of this
// block that the writes had to keep in step by hand.
//
// students.js reuses this for GET /api/students/:studentId/samples.
// Per-category counts of live (non-dismissed) errors, plus the running
// total - computed fresh on every read/write rather than stored, so it can
// never drift from the errors array it summarises. The client no longer
// needs to re-derive this itself.
function computeStatistics(errors) {
  const categoryCounts = Object.fromEntries(ERROR_CATEGORIES.map((category) => [category, 0]));
  let total = 0;
  for (const error of errors) {
    if (error.dismissed) continue;
    categoryCounts[error.category] += 1;
    total += 1;
  }
  return { categoryCounts, total };
}

function toClientSample(sample) {
  return {
    sampleId: sample._id,
    title: sample.title,
    uploadedAt: sample.createdAt,
    analysisStatus: sample.status, // UPLOADED | ANALYSED | REVIEWED
    imageCount: sample.pages.length,
    taskType: sample.taskType,
    // studentId is what lets the review screen's "back to profile" link
    // survive a hard refresh - the response holds no other reference to the
    // student. Still no imagePath: paths never leave the server.
    studentId: sample.student,
    illegibleNote: sample.illegibleNote,
    analysisError: sample.analysisError,
    // null for samples still UPLOADED, or ones analysed before this field
    // existed - the client falls back to generic copy in that case.
    analysedAt: sample.analysedAt,
    // The live threshold driving each error's "uncertain" flag, so the
    // client renders the Uncertain card state from the server's actual
    // configured value instead of a hardcoded guess that can drift from a
    // deployment's ERROR_CONFIDENCE_THRESHOLD override.
    confidenceThreshold: getConfidenceThreshold(),
    statistics: computeStatistics(sample.errors),
    // errorIndex is the position in errors[] - the errors sub-schema is
    // _id: false, so this is the only handle the client has on one error.
    // It is stable because a removed error is flagged dismissed, not deleted.
    errors: sample.errors.map((flagged, errorIndex) => ({
      errorIndex,
      written: flagged.written,
      intended: flagged.intended,
      category: flagged.category,
      confidenceScore: flagged.confidenceScore,
      locationOnScan: flagged.locationOnScan,
      note: flagged.note,
      dismissed: flagged.dismissed,
    })),
  };
}

// The list-of-samples summary, deliberately smaller than toClientSample():
// this route backs a list screen that only ever shows a status pill and a
// date, so it must never carry the (potentially large) errors array or any
// image reference - see paths.txt's "must NOT return sampleImages or
// sampleContent" rule for this route.
function toSampleSummary(sample) {
  return {
    sampleId: sample._id,
    title: sample.title,
    uploadedAt: sample.createdAt,
    analysisStatus: sample.status,
    imageCount: sample.pages.length,
  };
}

const getStudentSamples = async (req, res) => {
  const student = await Student.findById(req.params.studentId).catch(() => null);
  if (!student) {
    res.status(404);
    throw new Error('Student not found');
  }
  const filter = { student: req.params.studentId };
  if (req.query.status) {
    filter.status = req.query.status;
  }
  const samples = await Sample.find(filter).sort({ createdAt: -1 });
  res.status(200).json(samples.map(toSampleSummary));
};

const getSamples = async (req, res) => {
  const samples = await Sample.find({}).sort({ createdAt: -1 });
  res.json(samples.map(toClientSample));
};

// The single-sample route is the one the review screen (screen 3) reads.
const getSample = async (req, res) => {
  const sample = await Sample.findById(req.params.sampleId);
  if (!sample) {
    res.status(404);
    throw new Error('Sample not found');
  }
  res.json(toClientSample(sample));
};

const createSample = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error('No files uploaded under the "samples" field');
  }

  const student = await Student.findById(req.params.studentId).catch(() => null);
  if (!student) {
    // Clean up what multer already wrote to disk before we knew the
    // studentId was bad.
    await Promise.all(req.files.map((file) => fs.unlink(file.path).catch(() => {})));
    res.status(400);
    throw new Error(`Unknown studentId "${req.params.studentId}"`);
  }

  // Validate every file's real content and split any PDFs into pages
  // before writing anything to the Sample - a bad second file shouldn't
  // leave the first file's pages half-registered.
  let pageEntries;
  try {
    const perFile = await Promise.all(req.files.map(toPageFiles));
    pageEntries = perFile.flat().map((page) => ({
      imagePath: page.path,
      originalFilename: page.originalFilename,
    }));
  } catch (err) {
    await Promise.all(req.files.map((file) => fs.unlink(file.path).catch(() => {})));
    res.status(err.statusCode || 422);
    throw err;
  }

  let sample;
  try {
    sample = await Sample.create({
      student: req.params.studentId,
      title: req.body.title || req.files[0].originalname,
      pages: pageEntries,
      taskType: req.body.taskType,
    });
  } catch (err) {
    // A bad taskType (or any other schema validation failure) must not
    // leave the split PDF pages or the original upload(s) behind on disk -
    // the Sample row that would have owned them was never created.
    await Promise.all(pageEntries.map((page) => fs.unlink(page.imagePath).catch(() => {})));
    await Promise.all(req.files.map((file) => fs.unlink(file.path).catch(() => {})));
    throw err;
  }
  // 202, not 201: the Sample row exists, but analysis (below) has not run
  // yet and continues after this response is sent - see errorClassificationEngine.js.
  res.status(202).json(toClientSample(sample));
  runAnalysis(sample._id);
};

const getImages = async (req, res) => {
  const sample = await Sample.findById(req.params.sampleId);
  if (!sample) {
    res.status(404);
    throw new Error('Sample Not found');
  }
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= sample.pages.length) {
    res.status(404);
    throw new Error('Image not found');
  }
  const imagePath = sample.pages[index].imagePath;

  res.status(200).sendFile(imagePath);
};

const markReviewed = async (req, res) => {
  const validSampleStatus = ['UPLOADED', 'ANALYSED', 'REVIEWED', 'FAILED'];
  const sample = await Sample.findById(req.params.sampleId);
  if (!sample) {
    res.status(404);
    throw new Error('Sample Not found');
  }
  const status = req.body.status;
  if (!status || !validSampleStatus.includes(status)) {
    res.status(400);
    throw new Error('body usage incorrect submit correct status');
  }
  sample.status = status;
  await sample.save();
  res.status(200).json(toClientSample(sample));
};

const reclassifyError = async (req, res) => {
  const sample = await Sample.findById(req.params.sampleId);
  if (!sample) {
    res.status(404);
    throw new Error('Sample Not found');
  }
  const body = req.body ?? {};
  if (req.params.errorIndex === 'new') {
    if (typeof body.written !== 'string' || body.written.trim() === '') {
      res.status(400);
      throw new Error('Written text is required');
    }
    if (!ERROR_CATEGORIES.includes(body.category)) {
      res.status(400);
      throw new Error('Category wrong');
    }
    sample.errors.push({
      written: body.written,
      category: body.category,
      confidenceScore: 1,
      dismissed: false,
    });
    await sample.save();
    res.status(200).json(toClientSample(sample));
    return;
  }
  const index = Number(req.params.errorIndex);
  if (!Number.isInteger(index) || index < 0 || index >= sample.errors.length) {
    res.status(404);
    throw new Error('Error not found');
  }
  const hasCategory = Object.hasOwn(body, 'category');
  const hasDismissed = Object.hasOwn(body, 'dismissed');
  const hasConfidence = Object.hasOwn(body, 'confidenceScore');
  if (!hasCategory && !hasDismissed && !hasConfidence) {
    res.status(400);
    throw new Error('Provide category, dismissed, or confidenceScore');
  }
  if (hasCategory && !ERROR_CATEGORIES.includes(body.category)) {
    res.status(400);
    throw new Error('Category wrong');
  }
  if (hasDismissed && typeof body.dismissed !== 'boolean') {
    res.status(400);
    throw new Error('Dismissed must be boolean');
  }
  if (
    hasConfidence &&
    (typeof body.confidenceScore !== 'number' ||
      body.confidenceScore < 0 ||
      body.confidenceScore > 1)
  ) {
    res.status(400);
    throw new Error('Confidence score must be between 0 and 1');
  }
  if (hasCategory) sample.errors[index].category = body.category;
  if (hasDismissed) sample.errors[index].dismissed = body.dismissed;
  if (hasConfidence) sample.errors[index].confidenceScore = body.confidenceScore;
  await sample.save();
  res.status(200).json(toClientSample(sample));
};

export {
  getStudentSamples,
  createSample,
  getSamples,
  getSample,
  toClientSample,
  getImages,
  markReviewed,
  reclassifyError,
};
