// Fuzzes the "Student / MongoDB IDs" target from the robustness plan:
// GET /api/students/:studentId, GET /api/students/:studentId/samples, and
// GET /api/students/:studentId/trends?from=&to= - random strings, empty IDs,
// huge strings, Unicode, path-like input, invalid ObjectIds, and (for
// trends) malformed/impossible dates.
//
// Same in-memory Student/Sample fakes as the other integration tests here,
// except findById mimics real Mongoose behaviour: a non-24-hex-char id
// throws a CastError rather than just returning null, so this genuinely
// exercises errorHandler's CastError -> 400 mapping instead of skipping it.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import express from 'express';
import fc from 'fast-check';

import errorHandler from '../../middleware/errorHandler.js';
import { Sample } from '../../models/sample.js';
import { Student } from '../../models/student.js';
import studentRoutes from '../../routes/students.js';

const NUM_RUNS = Number(process.env.FUZZ_RUNS ?? 500);
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const KNOWN_STUDENT_ID = '64b000000000000000000055';

const originalMethods = {
  findStudentById: Student.findById,
  findStudents: Student.find,
  findSamples: Sample.find,
};

let students;
let server;
let baseUrl;

before(() => {
  const app = express();
  app.use('/api/students', studentRoutes);
  app.use(errorHandler);
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(() => {
  students = [{ _id: KNOWN_STUDENT_ID, name: 'Synthetic Learner', currentGrade: 'Primary 4' }];

  Student.findById = async (id) => {
    if (!OBJECT_ID_RE.test(id)) {
      const error = new Error(`Cast to ObjectId failed for value "${id}"`);
      error.name = 'CastError';
      throw error;
    }
    return students.find((s) => s._id === id) ?? null;
  };

  // An empty/malformed studentId can route to GET /api/students (the list
  // endpoint) rather than /:studentId, depending on how Express matches the
  // path - mock this too or that hits the real, unconnected Mongoose model
  // and hangs for its full connection-buffering timeout instead of failing
  // fast.
  Student.find = () => ({
    sort: async () => students,
  });

  // Only the trends route needs real sample data; the shape here matches
  // what getTrends reads (status, createdAt, errors[]).
  Sample.find = () => ({
    sort: async () => [],
  });
});

after(async () => {
  Student.findById = originalMethods.findStudentById;
  Student.find = originalMethods.findStudents;
  Sample.find = originalMethods.findSamples;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`);
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
    response.status >= 200 && response.status < 500,
    `${label} produced unexpected status ${response.status}`
  );
}

// A lone UTF-16 surrogate is a valid fc.string() output but makes
// encodeURIComponent throw - a limitation of building a URL in this test's
// own fetch() call, not something the server is being asked about.
const encodable = (s) => {
  try {
    encodeURIComponent(s);
    return true;
  } catch {
    return false;
  }
};

const studentIdArb = fc.oneof(
  fc.string({ maxLength: 300 }).filter(encodable),
  fc.constant(''),
  fc.constant('000000000000000000000000'),
  fc.constant('../../../etc/passwd'),
  fc.constant('$where'),
  fc.constant("' OR '1'='1"),
  fc
    .array(fc.constantFrom(..."0123456789abcdef".split('')), { minLength: 24, maxLength: 24 })
    .map((chars) => chars.join(''))
);

describe('student ID fuzz testing', () => {
  test('GET /api/students/:studentId never 500s', async () => {
    await fc.assert(
      fc.asyncProperty(studentIdArb, async (studentId) => {
        const { response } = await get(`/api/students/${encodeURIComponent(studentId)}`);
        assertControlled(response, `studentId "${studentId}"`);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  test('GET /api/students/:studentId/samples never 500s, with a fuzzed status filter too', async () => {
    await fc.assert(
      fc.asyncProperty(studentIdArb, fc.string({ maxLength: 50 }).filter(encodable), async (studentId, status) => {
        const qs = status ? `?status=${encodeURIComponent(status)}` : '';
        const { response } = await get(`/api/students/${encodeURIComponent(studentId)}/samples${qs}`);
        assertControlled(response, `studentId "${studentId}" status "${status}"`);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  test('a genuinely valid studentId still resolves after all this fuzzing', async () => {
    const { response, body } = await get(`/api/students/${KNOWN_STUDENT_ID}`);
    assert.equal(response.status, 200);
    assert.equal(body.studentId, KNOWN_STUDENT_ID);
  });
});

describe('trend route date fuzzing', () => {
  test('random from/to query values never 500', async () => {
    const dateOrGarbageArb = fc.oneof(
      fc.string({ maxLength: 100 }).filter(encodable),
      fc.constant('2026-02-30'), // impossible date
      fc.constant('2027-04-31'), // April has 30 days
      fc.constant('0000-00-00'),
      fc.constant('2026-13-01'), // month 13
      fc
        .date({ min: new Date('2000-01-01'), max: new Date('2030-12-31'), noInvalidDate: true })
        .map((d) => d.toISOString().slice(0, 10))
    );
    await fc.assert(
      fc.asyncProperty(dateOrGarbageArb, dateOrGarbageArb, async (from, to) => {
        const qs = new URLSearchParams();
        if (from) qs.set('from', from);
        if (to) qs.set('to', to);
        const { response } = await get(`/api/students/${KNOWN_STUDENT_ID}/trends?${qs}`);
        assertControlled(response, `from="${from}" to="${to}"`);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  test('a from date later than the to date is rejected, not silently accepted', async () => {
    const { response } = await get(
      `/api/students/${KNOWN_STUDENT_ID}/trends?from=2026-06-01&to=2026-01-01`
    );
    assert.equal(response.status, 400);
  });

  test('an impossible calendar date is rejected, not silently rounded forward', async () => {
    const { response } = await get(`/api/students/${KNOWN_STUDENT_ID}/trends?from=2026-02-30`);
    assert.equal(response.status, 400);
  });

  test('random/invalid studentId combined with trends params never 500', async () => {
    await fc.assert(
      fc.asyncProperty(studentIdArb, async (studentId) => {
        const { response } = await get(
          `/api/students/${encodeURIComponent(studentId)}/trends?from=garbage&to=also-garbage`
        );
        assertControlled(response, `studentId "${studentId}" with garbage dates`);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
