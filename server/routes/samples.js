import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getSample,
  getSamples,
  createSample,
  getImages,
  markReviewed,
  reclassifyError,
} from '../controllers/sampleController.js';
import {
  generateSampleWorksheets,
  getSampleWorksheets,
} from '../controllers/recommendationController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { MAX_FILE_SIZE } from '../middleware/upload.js';

// ------------------------------------------------------------------
// File storage (multer)
// ------------------------------------------------------------------
// Uploaded scans land in server/samples/<studentId>/, prefixed with a
// timestamp so two files with the same name never overwrite each other.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const studentId = req.params.studentId;
    // studentId lands directly in a path.join() below - reject anything with
    // a path separator, "..", or a control character (including a null
    // byte) before it ever touches the filesystem. A null byte in particular
    // makes fs.mkdirSync throw synchronously outside any try/catch in this
    // call chain - an uncaught exception that would crash the whole server
    // process, not just fail the one request.
    if (
      !studentId ||
      // eslint-disable-next-line no-control-regex
      /[\\/\x00-\x1f]/.test(studentId) ||
      studentId.includes('..') ||
      studentId.length > 200
    ) {
      const error = new Error('Missing or invalid studentId in the upload URL.');
      error.statusCode = 400;
      return cb(error);
    }
    // Belt and braces: fs.mkdirSync can still throw for reasons this check
    // doesn't anticipate (e.g. a reserved Windows device name). Route that
    // through cb() as a normal upload failure instead of letting it escape
    // uncaught and take the process down.
    try {
      const uploadDirectory = path.join(process.cwd(), 'samples', studentId);
      fs.mkdirSync(uploadDirectory, { recursive: true });
      return cb(null, uploadDirectory);
    } catch (err) {
      err.statusCode = 400;
      return cb(err);
    }
  },
  filename: (req, file, cb) => {
    // originalname is whatever the caller's multipart request claims it is -
    // characters like | * : " < > are invalid in a Windows filename and
    // fail the disk write with a plain ENOENT (not a MulterError), which
    // fell through as an uncontrolled 500 before this sanitised it instead.
    // Length is capped too: a 200+ character name pushes the full path past
    // Windows' MAX_PATH and fails the same way regardless of which
    // characters it contains.
    const safeName = file.originalname
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*%\x00-\x1f]/g, '_')
      .slice(0, 100);
    return cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage: storage, limits: { fileSize: MAX_FILE_SIZE } });

// multer rejects an oversized file, or more than 12 files, with a
// MulterError before createSample ever runs. Convert every kind of that
// error into the 422 validateSample() would have produced for any other
// unacceptable upload - falling through to next(err) unconverted left
// LIMIT_UNEXPECTED_FILE (13+ files) as an uncontrolled 500 with a leaked
// stack trace, since it has neither a statusCode nor a 4xx already set on
// res for errorHandler to fall back on.
function uploadSamples(req, res, next) {
  upload.array('samples', 12)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `One of the uploaded files is larger than ${MAX_FILE_SIZE / (1024 * 1024)}MB, the maximum accepted size.`
          : err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'No more than 12 files can be uploaded in a single sample.'
            : 'The upload request was malformed.';
      const uploadError = new Error(message);
      uploadError.statusCode = 422;
      return next(uploadError);
    }
    next(err);
  });
}

const router = express.Router();

// GET /api/samples — every sample, newest first.
router.route('/').get(getSamples);

// POST /api/samples/:studentId — upload a new sample for one student.
// Multipart form data: files under the field "samples" (up to 12; they all
// become pages of ONE sample), plus "title" and "taskType" text fields.
// The client polls GET /api/samples/:sampleId afterwards to see the status
// move from UPLOADED to ANALYSED once the AI analysis (Gemini, not wired
// up yet) has run.
router.route('/:studentId').post(uploadSamples, createSample);

// GET /api/samples/:sampleId — one sample's summary. The upload page polls
// this while the "Analysing…" screen is up.
router
  .route('/:sampleId/recommendations')
  .post(asyncHandler(generateSampleWorksheets))
  .get(asyncHandler(getSampleWorksheets));
router.route('/:sampleId').get(getSample).patch(markReviewed);
router.route('/:sampleId/images/:index').get(getImages);
router.route('/:sampleId/errors/:errorIndex').patch(reclassifyError);

export default router;
