// Fuzzes POST /api/samples/:studentId - the "Sample upload" row of the
// robustness plan: no file, empty file, unsupported/fake-extension/corrupted
// files, oversized files, too many files, invalid studentId/taskType, and
// unusual filenames. Same in-memory Sample/Student fakes as
// sampleUpload.integration.test.js (no MongoDB needed), driven by fast-check
// instead of fixed cases.
//
// Main robustness rule (same as auth.fuzz.test.js): malformed input may be
// rejected, but must never crash the server or return an uncontrolled 500.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import fc from 'fast-check';

process.env.USE_MOCK_AI = 'true';

import errorHandler from '../../middleware/errorHandler.js';
import { Sample } from '../../models/sample.js';
import { Student } from '../../models/student.js';
import sampleRoutes from '../../routes/samples.js';

const NUM_RUNS = Number(process.env.FUZZ_RUNS ?? 200);
const STUDENT_ID = '64b000000000000000000077';

const originalMethods = {
  create: Sample.create,
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
      const error = new Error('Sample validation failed: taskType is not a valid enum value.');
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
      save: async () => {},
    };
    records.push(record);
    return record;
  };
  Sample.findById = async (id) => records.find((record) => record._id === id) ?? null;
});

after(async () => {
  Sample.create = originalMethods.create;
  Sample.findById = originalMethods.findById;
  Student.findById = originalMethods.findStudentById;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  usedStudentIds.add(STUDENT_ID);
  usedStudentIds.add('fuzz-bad-student');
  await Promise.all(
    [...usedStudentIds]
      // An empty/falsy id here would resolve to samples/ itself (the join
      // collapses the trailing empty segment) - skip it rather than risk
      // recursively deleting every real sample directory alongside it.
      .filter(Boolean)
      .map((studentId) =>
        rm(path.join(process.cwd(), 'samples', studentId), { recursive: true, force: true }).catch(
          () => {}
        )
      )
  );
});

// ---- fixtures --------------------------------------------------------
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function minimalPdfBytes() {
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>`,
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
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}

// Any syntactically-valid studentId gets its own samples/<studentId>/
// directory created before createSample ever checks the student exists, so
// the "random/invalid studentId" property below litters real directories
// under dozens of fuzzed IDs, not just STUDENT_ID and 'fuzz-bad-student'.
// Track every one actually used so after() can sweep all of them.
const usedStudentIds = new Set();

async function upload({ studentId = STUDENT_ID, title = 'Fuzz sample', taskType = 'ESSAY', files }) {
  usedStudentIds.add(studentId);
  const form = new FormData();
  form.append('title', title);
  form.append('taskType', taskType);
  for (const file of files) {
    form.append('samples', new Blob([file.bytes], { type: file.type ?? '' }), file.name);
  }
  const response = await fetch(`${baseUrl}/api/samples/${encodeURIComponent(studentId)}`, {
    method: 'POST',
    body: form,
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // some failure paths may not produce JSON
  }
  return { response, body };
}

function assertControlled(response, label) {
  assert.notEqual(response.status, 500, `${label} caused HTTP 500`);
  assert.ok(
    response.status === 202 || (response.status >= 400 && response.status < 500),
    `${label} produced unexpected status ${response.status}`
  );
}

describe('sample upload fuzz testing', () => {
  test('no file submitted is rejected without crashing', async () => {
    const { response } = await upload({ files: [] });
    assert.equal(response.status, 400);
  });

  test('a 0-byte file is rejected without crashing', async () => {
    const { response } = await upload({
      files: [{ name: 'empty.png', bytes: Buffer.alloc(0), type: 'image/png' }],
    });
    assertControlled(response, 'empty file');
    assert.equal(response.status, 422);
  });

  test('random file counts (including past the 12-file cap) never 500', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 20 }), async (count) => {
        const files = Array.from({ length: count }, (_, i) => ({
          name: `scan${i}.png`,
          bytes: PNG_BYTES,
          type: 'image/png',
        }));
        const { response, body } = await upload({ files });
        assertControlled(response, `${count}-file upload`);
        if (count === 0) assert.equal(response.status, 400);
        else if (count <= 12) {
          assert.equal(response.status, 202);
          assert.equal(body.imageCount, count);
        } else assert.equal(response.status, 422);
      }),
      { numRuns: Math.min(NUM_RUNS, 20) }
    );
  });

  test('random bytes with a plausible filename/extension never 500', async () => {
    const extensionArb = fc.constantFrom('.jpg', '.png', '.pdf', '.docx', '.gif', '.exe', '');
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 0, maxLength: 2048 }),
        fc.string({ minLength: 1, maxLength: 40 }),
        extensionArb,
        async (bytes, stem, extension) => {
          const { response } = await upload({
            files: [{ name: `${stem}${extension}`, bytes: Buffer.from(bytes), type: 'application/octet-stream' }],
          });
          assertControlled(response, `random bytes named "${stem}${extension}"`);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  test('a real PDF signature with garbage content (corrupted PDF) never 500', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 0, maxLength: 4096 }), async (garbage) => {
        const corruptPdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from(garbage)]);
        const { response } = await upload({
          files: [{ name: 'corrupt.pdf', bytes: corruptPdf, type: 'application/pdf' }],
        });
        assertControlled(response, 'corrupted PDF');
        assert.equal(response.status, 422, 'a corrupt PDF must be rejected, not silently accepted');
      }),
      { numRuns: Math.min(NUM_RUNS, 50) }
    );
  });

  test('a file right at and just over the 10MB ceiling never 500', async () => {
    // Each case here pushes a real ~10MB body over loopback HTTP, which
    // dominates this file's runtime - two cases (just under, just over) is
    // enough to prove the boundary without tripling this test's cost.
    for (const size of [MAX_FILE_SIZE, MAX_FILE_SIZE + 1]) {
      const bytes = Buffer.concat([PNG_BYTES, Buffer.alloc(Math.max(size - PNG_BYTES.length, 0))]);
      const { response } = await upload({
        files: [{ name: `boundary-${size}.png`, bytes, type: 'image/png' }],
      });
      assertControlled(response, `${size}-byte file`);
      if (size > MAX_FILE_SIZE) assert.equal(response.status, 422);
    }
  });

  test('unusual, very long, unicode, and path-like filenames never 500 or escape the upload directory', async () => {
    const filenameArb = fc.oneof(
      fc.string({ minLength: 200, maxLength: 400 }).map((s) => `${s}.png`),
      fc.constant('../../../etc/passwd.png'),
      fc.constant('..\\..\\windows\\system32\\evil.png'),
      fc.constant('🧪📄сканирование.png'),
      fc.constant(''),
      fc.constant('.png'),
      fc.string({ minLength: 1, maxLength: 60 }).map((s) => `${s}.png`)
    );
    await fc.assert(
      fc.asyncProperty(filenameArb, async (filename) => {
        const { response } = await upload({
          files: [{ name: filename, bytes: PNG_BYTES, type: 'image/png' }],
        });
        assertControlled(response, `filename "${filename}"`);
      }),
      { numRuns: Math.min(NUM_RUNS, 100) }
    );
    // Whatever multer/toPageFiles did with the traversal-looking names above,
    // nothing should have landed outside this student's own upload folder.
    const escaped = await rm(path.join(process.cwd(), 'etc'), { recursive: true, force: true })
      .then(() => false)
      .catch(() => false);
    assert.equal(escaped, false);
  });

  test('random/invalid taskType values never 500', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 100 }), async (taskType) => {
        const validTaskTypes = ['ESSAY', 'LONG_ANSWER', 'SHORT_ANSWER'];
        const { response } = await upload({
          taskType,
          files: [{ name: 'scan.png', bytes: PNG_BYTES, type: 'image/png' }],
        });
        assertControlled(response, `taskType "${taskType}"`);
        if (!validTaskTypes.includes(taskType)) assert.notEqual(response.status, 202);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  test('random/invalid studentId route params never 500', async () => {
    // A lone UTF-16 surrogate is a valid fc.string() output but makes
    // encodeURIComponent throw - a limitation of building a URL in this
    // test's own fetch() call, not something the server is being asked
    // about, so it's filtered out here rather than treated as a case.
    const encodable = (s) => {
      try {
        encodeURIComponent(s);
        return true;
      } catch {
        return false;
      }
    };
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string({ maxLength: 200 }).filter(encodable),
          fc.constant(''),
          fc.constant('000000000000000000000000'),
          fc.constant('not-an-object-id')
        ),
        async (studentId) => {
          const { response } = await upload({
            studentId: studentId || 'fuzz-bad-student',
            files: [{ name: 'scan.png', bytes: PNG_BYTES, type: 'image/png' }],
          });
          assertControlled(response, `studentId "${studentId}"`);
          if (studentId !== STUDENT_ID) assert.notEqual(response.status, 202);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  test('a genuinely valid upload still succeeds after all this fuzzing', async () => {
    const { response, body } = await upload({
      files: [{ name: 'scan.pdf', bytes: minimalPdfBytes(), type: 'application/pdf' }],
    });
    assert.equal(response.status, 202);
    assert.equal(body.imageCount, 1);
  });
});
