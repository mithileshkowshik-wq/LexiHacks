import mongoose from 'mongoose';

import { RecommendationReport } from '../models/recommendationReport.js';
import { Sample } from '../models/sample.js';
import { Student } from '../models/student.js';
import { generateReport } from '../services/generateReport.js';
import { recommendWorksheets } from '../services/recommendWorksheet.js';
import { recommendationEngine } from '../services/recommendationEngine.js';
import { AppError } from '../utils/appError.js';
import { readBoundedResponse } from '../utils/readBoundedResponse.js';

// Keep controller logs structured and free of report contents or student writing.
function logAction(action, details = {}) {
  console.info(`[recommendation] ${action} ${JSON.stringify(details)}`);
}

// Fail early so invalid identifiers never reach MongoDB.
function assertObjectId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, 'INVALID_ID', 'The supplied resource ID is invalid.');
  }
}

// Keep the sample recommendation response stable across POST and GET routes.
function worksheetResponse(sample) {
  return {
    sampleId: sample._id.toString(),
    generatedAt: sample.recommendationsGeneratedAt,
    worksheets: sample.recommendedWorksheets,
  };
}

// Add computed freshness without persisting lifecycle or audit fields.
function reportResponse(report, isOutdated = false) {
  const value = typeof report.toJSON === 'function' ? report.toJSON() : report;
  return { ...value, isOutdated };
}

async function upsertLatestReport(studentId, generated) {
  try {
    return await RecommendationReport.findOneAndUpdate(
      { student: studentId },
      {
        $set: {
          ...generated,
          generatedAt: new Date(),
        },
      },
      {
        returnDocument: 'after',
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const winner = await RecommendationReport.findOne({ student: studentId });
    if (!winner) throw error;
    return winner;
  }
}

// Generate and retain only the student's newest intervention report.
export async function generateStudentRecommendations(req, res) {
  const { studentId } = req.params;
  const startedAt = Date.now();
  logAction('student-report-start', { studentId });
  assertObjectId(studentId);
  const student = await Student.findById(studentId);
  if (!student) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');

  const samples = await Sample.find({
    student: studentId,
    status: { $in: ['ANALYSED', 'REVIEWED'] },
  }).sort({ createdAt: 1 });
  logAction('student-report-samples-loaded', { studentId, samples: samples.length });
  const generated = await generateReport(student, samples);
  // Atomically replace the latest-only report after generation succeeds. The
  // unique student index prevents concurrent requests from creating duplicates.
  const report = await upsertLatestReport(studentId, generated);
  logAction('student-report-complete', {
    studentId,
    reportId: report._id.toString(),
    strategies: report.strategies.length,
    durationMs: Date.now() - startedAt,
  });
  res.status(201).json({ report: reportResponse(report) });
}

// Return the one current report without triggering a regeneration.
export async function getLatestStudentRecommendations(req, res) {
  const { studentId } = req.params;
  logAction('student-report-read-start', { studentId });
  assertObjectId(studentId);
  const report = await RecommendationReport.findOne({ student: studentId }).sort({
    generatedAt: -1,
  });
  if (!report) {
    throw new AppError(
      404,
      'RECOMMENDATION_NOT_FOUND',
      'No recommendation report has been generated.'
    );
  }
  const isOutdated = Boolean(
    await Sample.exists({
      student: studentId,
      $or: [
        {
          _id: { $in: report.basedOnSamples },
          updatedAt: { $gt: report.generatedAt },
        },
        {
          _id: { $nin: report.basedOnSamples },
          status: { $in: ['ANALYSED', 'REVIEWED'] },
        },
      ],
    })
  );
  logAction('student-report-read-complete', {
    studentId,
    reportId: report._id.toString(),
    strategies: report.strategies.length,
    isOutdated,
  });
  res.json({ report: reportResponse(report, isOutdated) });
}

// Run recommendation generation and persist its latest worksheet list on the
// sample. Only called from generateSampleWorksheets below - not exported,
// since nothing outside this file uses it.
async function generateAndSaveSampleWorksheets(sampleId) {
  const startedAt = Date.now();
  logAction('sample-worksheets-start', { sampleId });
  assertObjectId(sampleId);
  const sample = await Sample.findById(sampleId).populate(
    'student',
    'currentGrade programme band programmeYear term week'
  );
  if (!sample) throw new AppError(404, 'SAMPLE_NOT_FOUND', 'Sample not found.');
  sample.recommendedWorksheets = await recommendWorksheets(sample);
  sample.recommendationsGeneratedAt = new Date();
  await sample.save();
  logAction('sample-worksheets-complete', {
    sampleId,
    worksheets: sample.recommendedWorksheets.length,
    durationMs: Date.now() - startedAt,
  });
  return sample;
}

// HTTP wrapper for generating one sample's worksheet recommendations.
export async function generateSampleWorksheets(req, res) {
  const sample = await generateAndSaveSampleWorksheets(req.params.sampleId);
  res.status(201).json(worksheetResponse(sample));
}

// Return the worksheet recommendations already stored on a sample.
export async function getSampleWorksheets(req, res) {
  const { sampleId } = req.params;
  assertObjectId(sampleId);
  const sample = await Sample.findById(sampleId).select(
    'recommendedWorksheets recommendationsGeneratedAt'
  );
  if (!sample) throw new AppError(404, 'SAMPLE_NOT_FOUND', 'Sample not found.');
  logAction('sample-worksheets-read', {
    sampleId,
    worksheets: sample.recommendedWorksheets.length,
  });
  res.json(worksheetResponse(sample));
}

// Proxy an approved private Azure PDF so the browser never receives the SAS token.
export async function streamWorksheetFile(req, res) {
  const startedAt = Date.now();
  logAction('worksheet-stream-start', { worksheetId: req.params.worksheetId });
  const {
    worksheet,
    response,
    maxBytes = 20 * 1024 * 1024,
  } = await recommendationEngine.fetchWorksheet(req.params.worksheetId);
  if (!response.body) {
    throw new AppError(
      502,
      'AZURE_BLOB_FETCH_FAILED',
      'Azure Blob Storage returned an empty worksheet.'
    );
  }
  const upstreamType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (upstreamType !== 'application/pdf' && upstreamType !== 'application/octet-stream') {
    throw new AppError(
      502,
      'INVALID_WORKSHEET_CONTENT_TYPE',
      'Azure Blob Storage did not return a PDF worksheet.'
    );
  }
  const declaredBytes = Number.parseInt(response.headers.get('content-length'), 10);
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    throw new AppError(
      502,
      'WORKSHEET_TOO_LARGE',
      'The worksheet PDF is too large to open safely.'
    );
  }
  const bytes = await readBoundedResponse(response, maxBytes, {
    tooLarge: () =>
      new AppError(502, 'WORKSHEET_TOO_LARGE', 'The worksheet PDF is too large to open safely.'),
    interrupted: () =>
      new AppError(502, 'AZURE_BLOB_FETCH_FAILED', 'The worksheet download was interrupted.'),
  });
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new AppError(
      502,
      'INVALID_WORKSHEET_FILE',
      'Azure Blob Storage returned an invalid PDF.'
    );
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `inline; filename="${worksheet.worksheetId}.pdf"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(bytes);
  logAction('worksheet-stream-complete', {
    worksheetId: worksheet.worksheetId,
    durationMs: Date.now() - startedAt,
  });
}
