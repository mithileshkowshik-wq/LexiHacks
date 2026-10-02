import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import express from 'express';

import errorHandler from '../middleware/errorHandler.js';
import { Sample } from '../models/sample.js';
import { Student } from '../models/student.js';
import studentRoutes from '../routes/students.js';

const originalMethods = {
  create: Student.create,
  find: Student.find,
  findById: Student.findById,
  findSamples: Sample.find,
};

let records;
let nextId;
let sampleFilter;
let server;
let baseUrl;

before(() => {
  const app = express();
  app.use(express.json());
  app.use('/api/students', studentRoutes);
  app.use(errorHandler);

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(() => {
  records = [];
  nextId = 1;
  sampleFilter = null;

  Student.create = async ({ name, currentGrade, programme, band, programmeYear, term, week }) => {
    const student = {
      _id: String(nextId++).padStart(24, '0'),
      name: name.trim(),
      currentGrade: currentGrade.trim(),
      programme: programme ?? null,
      band: band ?? null,
      programmeYear: programmeYear ?? null,
      term: term ?? null,
      week: week ?? null,
      createdAt: new Date(),
      __v: 0,
    };
    records.push(student);
    return student;
  };

  Student.find = () => ({
    sort: async () => [...records].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  });

  Student.findById = async (id) => records.find((student) => student._id === id) ?? null;

  Sample.find = (filter) => {
    sampleFilter = filter;
    return { sort: async () => [] };
  };
});

after(async () => {
  Student.create = originalMethods.create;
  Student.find = originalMethods.find;
  Student.findById = originalMethods.findById;
  Sample.find = originalMethods.findSamples;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: await response.json() };
}

describe('students API integration', () => {
  test('POST creates and serializes a student through the full HTTP stack', async () => {
    const { response, body } = await request('/api/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  Aisha Rahman  ', currentGrade: ' Primary 3 ' }),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(body, {
      studentId: '000000000000000000000001',
      name: 'Aisha Rahman',
      currentGrade: 'Primary 3',
    });
    assert.equal('_id' in body, false);
    assert.equal('__v' in body, false);
  });

  test('POST round-trips optional programme placement metadata', async () => {
    const { response, body } = await request('/api/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '  Context Student  ',
        currentGrade: ' Secondary 1 ',
        programme: ' SLP ',
        band: ' B ',
        programmeYear: 1,
        term: 1,
        week: 4,
      }),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(body, {
      studentId: '000000000000000000000001',
      name: 'Context Student',
      currentGrade: 'Secondary 1',
      programme: 'SLP',
      band: 'B',
      programmeYear: 1,
      term: 1,
      week: 4,
    });
    assert.deepEqual((await request('/api/students/000000000000000000000001')).body, body);
  });

  test('POST rejects missing required fields through the error middleware', async () => {
    const { response, body } = await request('/api/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Aisha Rahman' }),
    });

    assert.equal(response.status, 400);
    assert.equal(body.title, 'Validation error');
    assert.equal(body.message, 'All fields are mandatory!');
    assert.equal(records.length, 0);
  });

  test('POST rejects invalid placement metadata', async () => {
    for (const body of [
      { name: 'Aisha Rahman', currentGrade: 'Primary 3', band: 'D' },
      { name: 'Aisha Rahman', currentGrade: 'Primary 3', programmeYear: 0 },
      { name: 'Aisha Rahman', currentGrade: 'Primary 3', term: 5 },
      { name: 'Aisha Rahman', currentGrade: 'Primary 3', week: 21 },
    ]) {
      const { response } = await request('/api/students', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
    }
    assert.equal(records.length, 0);
  });

  test('GET lists students newest first using the public response shape', async () => {
    records.push(
      {
        _id: '000000000000000000000001',
        name: 'Older Student',
        currentGrade: 'Primary 3',
        createdAt: new Date('2026-01-01'),
      },
      {
        _id: '000000000000000000000002',
        name: 'Newer Student',
        currentGrade: 'Primary 4',
        createdAt: new Date('2026-02-01'),
      }
    );

    const { response, body } = await request('/api/students');

    assert.equal(response.status, 200);
    assert.deepEqual(
      body.map((student) => student.name),
      ['Newer Student', 'Older Student']
    );
    assert.deepEqual(Object.keys(body[0]), ['studentId', 'name', 'currentGrade']);
  });

  test('GET returns one student and reports an unknown student as 404', async () => {
    records.push({
      _id: '000000000000000000000007',
      name: 'Wei Jie Lim',
      currentGrade: 'Primary 4',
      createdAt: new Date(),
    });

    const found = await request('/api/students/000000000000000000000007');
    assert.equal(found.response.status, 200);
    assert.equal(found.body.name, 'Wei Jie Lim');

    const missing = await request('/api/students/000000000000000000000099');
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.title, 'Not found');
    assert.equal(missing.body.message, 'Student not found');
  });

  test('GET trends includes the entire requested to date', async () => {
    records.push({
      _id: '000000000000000000000007',
      name: 'Wei Jie Lim',
      currentGrade: 'Primary 4',
      createdAt: new Date(),
    });

    const { response, body } = await request(
      '/api/students/000000000000000000000007/trends?to=2026-07-27'
    );

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      studentId: '000000000000000000000007',
      totalSamples: 0,
      totalErrors: 0,
      mostFrequentCategory: null,
      categoryTotals: {
        phonological: 0,
        orthographic: 0,
        morphological: 0,
        capitalisation: 0,
        punctuation: 0,
        unsure: 0,
      },
      trends: [],
    });
    assert.equal(sampleFilter.status.$in.join(','), 'ANALYSED,REVIEWED');
    assert.equal(sampleFilter.createdAt.$lt.toISOString(), '2026-07-28T00:00:00.000Z');
  });

  test('GET trends rejects incorrectly formatted and impossible dates', async () => {
    records.push({
      _id: '000000000000000000000007',
      name: 'Wei Jie Lim',
      currentGrade: 'Primary 4',
      createdAt: new Date(),
    });

    for (const date of ['2026/07/27', '2026-02-30']) {
      const { response, body } = await request(
        `/api/students/000000000000000000000007/trends?from=${date}`
      );

      assert.equal(response.status, 400);
      assert.equal(body.message, 'The "from" date must use the YYYY-MM-DD format');
    }
  });

  test('GET trends reports an unknown student as 404', async () => {
    const { response, body } = await request('/api/students/000000000000000000000099/trends');

    assert.equal(response.status, 404);
    assert.equal(body.message, 'Student not found');
  });

  test('GET trends rejects a from date later than the to date', async () => {
    records.push({
      _id: '000000000000000000000007',
      name: 'Wei Jie Lim',
      currentGrade: 'Primary 4',
      createdAt: new Date(),
    });

    const { response, body } = await request(
      '/api/students/000000000000000000000007/trends?from=2026-08-01&to=2026-01-01'
    );

    assert.equal(response.status, 400);
    assert.equal(body.message, 'The "from" date must not be later than the "to" date');
  });
});
