// Exercises POST /api/samples/:studentId and GET /api/students/:studentId/samples
// through the real HTTP + multer + file-type + pdf-to-img stack (routes/samples.js
// and routes/students.js, unmounted from auth since none of the other integration
// tests in this file set that up either). Sample.create/find/findById and
// Student.findById are swapped for plain in-memory fakes so no MongoDB is needed,
// following the same pattern as students.integration.test.js.
//
// These three scenarios were implemented but never verified by a test:
//   - JPG, PNG and a multi-page PDF each produce the right imageCount.
//   - A file the server can't identify (e.g. a .docx) is rejected with a 422
//     that names the real offending file.
//   - The list summary never carries image data or the errors array.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';

process.env.USE_MOCK_AI = 'true';

import errorHandler from '../middleware/errorHandler.js';
import { Sample } from '../models/sample.js';
import { Student } from '../models/student.js';
import sampleRoutes from '../routes/samples.js';
import studentRoutes from '../routes/students.js';

const STUDENT_ID = '64b000000000000000000099';

const originalMethods = {
  create: Sample.create,
  find: Sample.find,
  findById: Sample.findById,
  findStudentById: Student.findById,
};

let records;
let nextId;
let server;
let baseUrl;

before(() => {
  const app = express();
  app.use('/api/samples', sampleRoutes);
  app.use('/api/students', studentRoutes);
  app.use(errorHandler);

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(() => {
  records = [];
  nextId = 1;

  Student.findById = async (id) =>
    id === STUDENT_ID ? { _id: STUDENT_ID, name: 'Synthetic Learner' } : null;

  const validTaskTypes = ['ESSAY', 'LONG_ANSWER', 'SHORT_ANSWER'];
  Sample.create = async (doc) => {
    if (!validTaskTypes.includes(doc.taskType)) {
      const error = new Error('Sample validation failed: taskType: `undefined` is not a valid enum value.');
      error.name = 'ValidationError';
      throw error;
    }
    const record = {
      _id: String(nextId++).padStart(24, '0'),
      student: doc.student,
      title: doc.title,
      taskType: doc.taskType,
      pages: doc.pages,
      status: 'UPLOADED',
      errors: [],
      illegibleNote: '',
      analysisError: '',
      analysedAt: null,
      createdAt: new Date(),
      // runAnalysis (fired in the background after the 202 response) calls
      // this - a no-op keeps that job from throwing into an unhandled
      // rejection once it settles the mocked record to ANALYSED/FAILED.
      save: async () => {},
    };
    records.push(record);
    return record;
  };

  Sample.findById = async (id) => records.find((record) => record._id === id) ?? null;
  Sample.find = (filter = {}) => ({
    sort: async () =>
      records.filter((record) => {
        if (filter.student && record.student !== filter.student) return false;
        if (filter.status && record.status !== filter.status) return false;
        return true;
      }),
  });
});

after(async () => {
  Sample.create = originalMethods.create;
  Sample.find = originalMethods.find;
  Sample.findById = originalMethods.findById;
  Student.findById = originalMethods.findStudentById;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  // toPageFiles/multer really do write under server/samples/<studentId>/ for
  // these tests - clean up what they left behind.
  await rm(path.join(process.cwd(), 'samples', STUDENT_ID), { recursive: true, force: true });
});

// ---- fixtures ------------------------------------------------------------
// file-type sniffs the file's magic bytes, not full validity, so a real JPG
// or PNG header is enough for the single-page path (it never re-encodes the
// image). The PDF path is different: pdf-to-img genuinely parses and renders
// the file, so buildMinimalPdf constructs a real, spec-valid PDF with however
// many blank pages are asked for, computing correct xref byte offsets.

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
]);
const NOT_A_SUPPORTED_FORMAT = Buffer.from(
  'plain bytes with no recognisable image or PDF signature, standing in for a .docx'
);

function buildMinimalPdf(pageCount) {
  const kids = Array.from({ length: pageCount }, (_, i) => `${3 + i} 0 R`).join(' ');
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`,
    ...Array.from(
      { length: pageCount },
      () => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>`
    ),
  ];

  let body = '%PDF-1.4\n';
  const offsets = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${offsets.length} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  const total = objects.length + 1;
  body += `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}

async function uploadSample({ files, title = 'Synthetic writing sample', taskType = 'ESSAY' }) {
  const form = new FormData();
  form.append('title', title);
  form.append('taskType', taskType);
  for (const file of files) {
    form.append('samples', new Blob([file.bytes], { type: file.type }), file.name);
  }
  const response = await fetch(`${baseUrl}/api/samples/${STUDENT_ID}`, {
    method: 'POST',
    body: form,
  });
  const body = await response.json();
  return { response, body };
}

describe('sample upload produces the right imageCount per format', () => {
  test('a JPG upload is one page', async () => {
    const { response, body } = await uploadSample({
      files: [{ name: 'scan.jpg', bytes: JPEG_BYTES, type: 'image/jpeg' }],
    });
    assert.equal(response.status, 202);
    assert.equal(body.imageCount, 1);
  });

  test('a PNG upload is one page', async () => {
    const { response, body } = await uploadSample({
      files: [{ name: 'scan.png', bytes: PNG_BYTES, type: 'image/png' }],
    });
    assert.equal(response.status, 202);
    assert.equal(body.imageCount, 1);
  });

  test('a multi-page PDF upload produces one page per PDF page', async () => {
    const { response, body } = await uploadSample({
      files: [{ name: 'essay.pdf', bytes: buildMinimalPdf(3), type: 'application/pdf' }],
    });
    assert.equal(response.status, 202);
    assert.equal(body.imageCount, 3);
  });
});

describe('sample upload rejects unsupported files', () => {
  test('a .docx upload gets a 422 naming the real file and the accepted formats', async () => {
    const { response, body } = await uploadSample({
      files: [{ name: 'essay.docx', bytes: NOT_A_SUPPORTED_FORMAT, type: 'application/octet-stream' }],
    });
    assert.equal(response.status, 422);
    assert.match(body.message, /essay\.docx/);
    assert.match(body.message, /JPG, PNG and PDF/);
  });
});

describe('the sample summary list', () => {
  test('never carries image data or the errors array', async () => {
    await uploadSample({ files: [{ name: 'scan.jpg', bytes: JPEG_BYTES, type: 'image/jpeg' }] });

    const response = await fetch(`${baseUrl}/api/students/${STUDENT_ID}/samples`);
    const summaries = await response.json();

    assert.equal(response.status, 200);
    assert.equal(summaries.length, 1);
    assert.deepEqual(
      Object.keys(summaries[0]).sort(),
      ['analysisStatus', 'imageCount', 'sampleId', 'title', 'uploadedAt'].sort()
    );
    const serialised = JSON.stringify(summaries);
    assert.equal(serialised.includes('imagePath'), false);
    assert.equal(serialised.includes('errors'), false);
    assert.equal(serialised.includes('pages'), false);
  });
});
