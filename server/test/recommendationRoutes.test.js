import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

// A fixed secret, set before anything reads it - independent of whatever
// (if anything) is in a real .env, since these tests never touch a real
// account either.
process.env.JWT_SECRET ??= 'test-only-secret-do-not-use-in-production';

import app from '../app.js';
import {
  generateStudentRecommendations,
  getLatestStudentRecommendations,
} from '../controllers/recommendationController.js';
import { RecommendationReport } from '../models/recommendationReport.js';
import { Sample } from '../models/sample.js';
import { Student } from '../models/student.js';
import { recommendationEngine } from '../services/recommendationEngine.js';
import { signToken } from '../utils/jwt.js';

const authHeaders = { Authorization: `Bearer ${signToken({ username: 'test-user' })}` };

async function withServer(run) {
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test('simplified recommendation endpoints validate student and sample IDs', async () => {
  await withServer(async (baseUrl) => {
    for (const [method, path] of [
      ['POST', '/api/students/not-an-id/recommendations'],
      ['GET', '/api/students/not-an-id/recommendations/latest'],
      ['POST', '/api/samples/not-an-id/recommendations'],
      ['GET', '/api/samples/not-an-id/recommendations'],
    ]) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: method === 'GET' ? undefined : '{}',
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'INVALID_ID');
    }
  });
});

test('lifecycle endpoints were removed', async () => {
  await withServer(async (baseUrl) => {
    const regenerate = await fetch(
      `${baseUrl}/api/students/507f1f77bcf86cd799439011/recommendations/regenerate`,
      { method: 'POST', headers: authHeaders }
    );
    const flag = await fetch(`${baseUrl}/api/recommendations/507f1f77bcf86cd799439011/flag`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    assert.equal(regenerate.status, 404);
    assert.equal(flag.status, 404);
  });
});

test('legacy recommendation route remains available during migration', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/recommendation`, { headers: authHeaders });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'Hello world');
  });
});

test('student report generation atomically upserts the latest-only report', async () => {
  const studentId = new mongoose.Types.ObjectId();
  const sampleId = new mongoose.Types.ObjectId();
  const reportId = new mongoose.Types.ObjectId();
  const originals = {
    findStudent: Student.findById,
    findSamples: Sample.find,
    upsertReport: RecommendationReport.findOneAndUpdate,
  };
  let upsert;
  Student.findById = async () => ({ _id: studentId, currentGrade: 'Primary 4' });
  Sample.find = () => ({
    sort: async () => [
      {
        _id: sampleId,
        status: 'REVIEWED',
        errors: [
          {
            written: 'hop',
            intended: 'hope',
            category: 'phonological',
            note: 'long vowel',
            dismissed: false,
          },
        ],
      },
    ],
  });
  RecommendationReport.findOneAndUpdate = async (filter, update, options) => {
    upsert = { filter, update, options };
    return { _id: reportId, strategies: update.$set.strategies };
  };
  try {
    let statusCode;
    let payload;
    await generateStudentRecommendations(
      { params: { studentId: studentId.toString() } },
      {
        status(code) {
          statusCode = code;
          return this;
        },
        json(value) {
          payload = value;
        },
      }
    );

    assert.equal(statusCode, 201);
    assert.equal(payload.report._id, reportId);
    assert.deepEqual(upsert.filter, { student: studentId.toString() });
    assert.equal(upsert.options.returnDocument, 'after');
    assert.equal(upsert.options.upsert, true);
    assert.equal(upsert.options.runValidators, true);
    assert.ok(upsert.update.$set.generatedAt instanceof Date);
    assert.deepEqual(upsert.update.$set.basedOnSamples, [sampleId]);
  } finally {
    Student.findById = originals.findStudent;
    Sample.find = originals.findSamples;
    RecommendationReport.findOneAndUpdate = originals.upsertReport;
  }
});

test('student report generation recovers when a concurrent first upsert wins', async () => {
  const studentId = new mongoose.Types.ObjectId();
  const sampleId = new mongoose.Types.ObjectId();
  const reportId = new mongoose.Types.ObjectId();
  const winner = { _id: reportId, strategies: [], toJSON: () => ({ reportId }) };
  const originals = {
    findStudent: Student.findById,
    findSamples: Sample.find,
    findReport: RecommendationReport.findOne,
    upsertReport: RecommendationReport.findOneAndUpdate,
  };
  Student.findById = async () => ({ _id: studentId, currentGrade: 'Primary 4' });
  Sample.find = () => ({
    sort: async () => [
      {
        _id: sampleId,
        status: 'REVIEWED',
        errors: [
          {
            written: 'hop',
            intended: 'hope',
            category: 'phonological',
            note: 'long vowel',
            dismissed: false,
          },
        ],
      },
    ],
  });
  RecommendationReport.findOneAndUpdate = async () => {
    const error = new Error('duplicate key');
    error.code = 11000;
    throw error;
  };
  RecommendationReport.findOne = async () => winner;
  try {
    let payload;
    await generateStudentRecommendations(
      { params: { studentId: studentId.toString() } },
      {
        status() {
          return this;
        },
        json(value) {
          payload = value;
        },
      }
    );
    assert.equal(payload.report.reportId, reportId);
  } finally {
    Student.findById = originals.findStudent;
    Sample.find = originals.findSamples;
    RecommendationReport.findOne = originals.findReport;
    RecommendationReport.findOneAndUpdate = originals.upsertReport;
  }
});

test('latest report is marked outdated when usable sample evidence changed', async () => {
  const studentId = new mongoose.Types.ObjectId();
  const sampleId = new mongoose.Types.ObjectId();
  const generatedAt = new Date('2026-07-29T00:00:00.000Z');
  const originals = {
    findReport: RecommendationReport.findOne,
    existsSample: Sample.exists,
  };
  let staleQuery;
  RecommendationReport.findOne = () => ({
    sort: async () => ({
      _id: new mongoose.Types.ObjectId(),
      student: studentId,
      basedOnSamples: [sampleId],
      strategies: [],
      generatedAt,
      toJSON() {
        return {
          reportId: this._id.toString(),
          student: this.student,
          basedOnSamples: this.basedOnSamples,
          strategies: this.strategies,
          generatedAt: this.generatedAt,
        };
      },
    }),
  });
  Sample.exists = async (query) => {
    staleQuery = query;
    return { _id: sampleId };
  };
  try {
    let payload;
    await getLatestStudentRecommendations(
      { params: { studentId: studentId.toString() } },
      { json: (value) => (payload = value) }
    );

    assert.equal(payload.report.isOutdated, true);
    assert.equal(staleQuery.student, studentId.toString());
    assert.deepEqual(staleQuery.$or[0], {
      _id: { $in: [sampleId] },
      updatedAt: { $gt: generatedAt },
    });
    assert.deepEqual(staleQuery.$or[1], {
      _id: { $nin: [sampleId] },
      status: { $in: ['ANALYSED', 'REVIEWED'] },
    });
  } finally {
    RecommendationReport.findOne = originals.findReport;
    Sample.exists = originals.existsSample;
  }
});

test('worksheet file endpoint rejects IDs outside the approved index', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/worksheets/not-approved/file`, {
      headers: authHeaders,
    });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'WORKSHEET_NOT_FOUND');
  });
});

test('worksheet file endpoint forces a non-sniffable PDF response', async () => {
  const originalFetchWorksheet = recommendationEngine.fetchWorksheet;
  recommendationEngine.fetchWorksheet = async (worksheetId) => ({
    worksheet: { worksheetId },
    response: new Response('%PDF-1.7', {
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
  });
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/worksheets/approved/file`, {
        headers: authHeaders,
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'application/pdf');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(await response.text(), '%PDF-1.7');
    });
  } finally {
    recommendationEngine.fetchWorksheet = originalFetchWorksheet;
  }
});

test('worksheet file endpoint rejects active upstream content', async () => {
  const originalFetchWorksheet = recommendationEngine.fetchWorksheet;
  recommendationEngine.fetchWorksheet = async (worksheetId) => ({
    worksheet: { worksheetId },
    response: new Response('<script>unsafe</script>', {
      headers: { 'Content-Type': 'text/html' },
    }),
  });
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/worksheets/approved/file`, {
        headers: authHeaders,
      });
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error.code, 'INVALID_WORKSHEET_CONTENT_TYPE');
    });
  } finally {
    recommendationEngine.fetchWorksheet = originalFetchWorksheet;
  }
});

test('worksheet file endpoint validates PDF bytes even for octet-stream metadata', async () => {
  const originalFetchWorksheet = recommendationEngine.fetchWorksheet;
  recommendationEngine.fetchWorksheet = async (worksheetId) => ({
    worksheet: { worksheetId },
    response: new Response('<script>unsafe</script>', {
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
    maxBytes: 1024,
  });
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/worksheets/approved/file`, {
        headers: authHeaders,
      });
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error.code, 'INVALID_WORKSHEET_FILE');
    });
  } finally {
    recommendationEngine.fetchWorksheet = originalFetchWorksheet;
  }
});

test('worksheet file endpoint rejects oversized approved blobs', async () => {
  const originalFetchWorksheet = recommendationEngine.fetchWorksheet;
  recommendationEngine.fetchWorksheet = async (worksheetId) => ({
    worksheet: { worksheetId },
    response: new Response('%PDF-1.7 oversized', {
      headers: { 'Content-Type': 'application/pdf', 'Content-Length': '18' },
    }),
    maxBytes: 8,
  });
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/worksheets/approved/file`, {
        headers: authHeaders,
      });
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error.code, 'WORKSHEET_TOO_LARGE');
    });
  } finally {
    recommendationEngine.fetchWorksheet = originalFetchWorksheet;
  }
});
