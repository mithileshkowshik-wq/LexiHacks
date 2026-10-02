import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.USE_MOCK_AI = 'true';
process.env.RECOMMENDATION_USE_MOCKS = 'true';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'lexipath-revised-plan-test-secret';

const { default: app } = await import('../app.js');
const { Account } = await import('../models/account.js');
const { RecommendationReport } = await import('../models/recommendationReport.js');
const { Sample } = await import('../models/sample.js');
const { Student } = await import('../models/student.js');
const { runAnalysis } = await import('../services/errorClassificationEngine.js');
const { signToken } = await import('../utils/jwt.js');

const authorization = `Bearer ${signToken({ username: 'Synthetic@DAS' })}`;

const ids = [
  'BI-UC1-01',
  'BI-UC1-02',
  'BI-UC1-03',
  'BI-UC1-04',
  'BI-UC1-05',
  'BI-UC1-06',
  'BI-UC1-07',
  'BI-UC1-08',
  'BI-UC1-09',
  'BI-UC1-10',
  'BI-UC2-01',
  'BI-UC2-02',
  'BI-UC2-03',
  'BI-UC2-04',
  'BI-UC2-05',
  'BI-UC2-06',
  'BI-UC2-07',
  'BI-UC2-08',
  'BI-UC2-09',
  'BI-UC2-10',
  'BI-UC3-01',
  'BI-UC3-02',
  'BI-UC3-03',
  'BI-UC3-04',
  'BI-UC3-05',
  'BI-UC3-06',
  'BI-UC3-07',
  'BI-UC3-08',
  'BI-UC3-09',
  'BI-UC3-10',
  'BI-UC3-11',
  'BI-UC3-12',
  'BI-UC4-01',
  'BI-UC4-02',
  'BI-UC4-03',
  'BI-UC4-04',
  'BI-UC4-05',
  'BI-UC4-06',
  'BI-UC4-07',
  'BI-UC4-08',
  'BI-UC4-09',
  'BI-UC4-10',
  'BI-UC5-01',
  'BI-UC5-02',
  'BI-UC5-03',
  'BI-UC5-04',
  'BI-UC5-05',
  'BI-UC5-06',
  'BI-UC5-07',
  'BI-UC5-08',
  'BI-UC5-09',
  'BI-UC5-10',
  'BI-UC6-01',
  'BI-UC6-02',
  'BI-UC6-03',
  'BI-UC6-04',
  'BI-UC6-05',
  'BI-UC6-06',
  'BI-UC6-07',
  'BI-UC6-08',
  'BI-UC6-09',
  'BI-UC6-10',
  'BI-UC6-11',
  'BI-UC7-01',
  'BI-UC7-02',
  'BI-UC7-03',
  'BI-UC7-04',
  'BI-UC7-05',
  'BI-UC7-06',
  'BI-UC7-07',
  'BI-UC7-08',
  'BI-UC7-09',
  'BI-UC7-10',
  'BI-UC8-01',
  'BI-UC8-02',
  'BI-UC8-03',
  'BI-UC8-04',
  'BI-UC8-05',
  'BI-UC8-06',
  'BI-UC8-07',
  'BI-UC8-08',
  'BI-UC8-09',
  'BI-UC8-10',
  'BI-UC8-11',
  'BI-UC9-01',
  'BI-UC9-02',
  'BI-UC9-03',
  'BI-UC9-04',
  'BI-UC9-05',
  'BI-UC9-06',
  'BI-UC9-07',
  'BI-UC9-08',
  'BI-UC9-09',
  'BI-UC9-10',
  'BI-UC9-11',
  'BI-UC9-12',
  'BI-UC9-13',
  'BI-UC9-14',
  'BI-UC9-15',
];

let mongo;
let server;
let baseUrl;

async function json(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { authorization, ...options?.headers },
  });
  return { response, body: await response.json() };
}

async function student() {
  return Student.create({ name: 'Synthetic Learner', currentGrade: 'Primary 4' });
}

async function sampleFor(owner, overrides = {}) {
  return Sample.create({
    student: owner._id,
    title: 'Synthetic writing',
    pages: [{ imagePath: '/tmp/lexipath-synthetic.png', originalFilename: 'synthetic.png' }],
    taskType: 'ESSAY',
    status: 'ANALYSED',
    errors: [
      { written: 'becos', category: 'phonological', confidenceScore: 0.5, dismissed: false },
      { written: 'dont', category: 'punctuation', confidenceScore: 0.9, dismissed: true },
    ],
    ...overrides,
  });
}

async function account() {
  return Account.create({
    username: 'Synthetic@DAS',
    email: 'synthetic@example.invalid',
    passwordHash: await bcrypt.hash('Pass@123', 4),
    name: 'Synthetic Educator',
  });
}

async function probe(id) {
  const [, useCase, suffix] = id.match(/^BI-(UC\d+)-(\d+)$/);
  const number = Number(suffix);

  if (useCase === 'UC1') {
    const owner = await student();
    const record = await sampleFor(owner, {
      status: 'UPLOADED',
      errors: [],
      pages: [
        {
          imagePath: number % 2 === 0 ? '/tmp/corrupt-synthetic.png' : '/tmp/synthetic.png',
          originalFilename: number % 2 === 0 ? 'corrupt-synthetic.png' : 'synthetic.png',
        },
      ],
    });
    await runAnalysis(record._id);
    const saved = await Sample.findById(record._id);
    assert.equal(saved.status, number % 2 === 0 ? 'FAILED' : 'ANALYSED');
    assert.equal(
      saved.status === 'FAILED' ? saved.errors.length : saved.errors.length > 0,
      saved.status === 'FAILED' ? 0 : true
    );
    return;
  }

  if (useCase === 'UC2') {
    const owner = await student();
    const record = await sampleFor(owner);
    const target = number % 2 === 0 ? new mongoose.Types.ObjectId() : record._id;
    const { response, body } = await json(`/api/samples/${target}`);
    assert.equal(response.status, number % 2 === 0 ? 404 : 200);
    if (response.ok) {
      assert.equal(body.errors[0].written, 'becos');
      assert.equal(body.statistics.total, 1);
      assert.equal(JSON.stringify(body).includes('imagePath'), false);
    }
    return;
  }

  if (useCase === 'UC3') {
    const owner = await student();
    const record = await sampleFor(owner);
    if (number % 3 !== 0) {
      await RecommendationReport.create({
        student: owner._id,
        basedOnSamples: [record._id],
        strategies: [{ strategy: 'Synthetic strategy', rationale: 'Grounded synthetic rationale' }],
      });
    }
    const before = await RecommendationReport.countDocuments();
    const { response, body } = await json(`/api/students/${owner._id}/recommendations/latest`);
    assert.equal(response.status, number % 3 === 0 ? 404 : 200);
    assert.equal(
      await RecommendationReport.countDocuments(),
      before,
      'read path must not generate or write'
    );
    if (response.ok) assert.equal(body.report.strategies[0].strategy, 'Synthetic strategy');
    return;
  }

  if (useCase === 'UC4') {
    const owner = await student();
    await sampleFor(owner, { createdAt: new Date('2026-07-27T23:59:59.000Z') });
    const query = number % 3 === 0 ? '?from=2026-08-01&to=2026-01-01' : '?to=2026-07-27';
    const { response, body } = await json(`/api/students/${owner._id}/trends${query}`);
    assert.equal(response.status, number % 3 === 0 ? 400 : 200);
    if (response.ok) {
      assert.equal(body.totalSamples, 1);
      assert.equal(body.totalErrors, 1, 'dismissed errors are excluded');
    }
    return;
  }

  if (useCase === 'UC5') {
    const owner = await student();
    const record = await sampleFor(owner);
    const invalid = number === 10;
    const path = `/api/samples/${record._id}/errors/${invalid ? 99 : 0}`;
    const patch =
      number % 3 === 0
        ? { dismissed: true }
        : number % 3 === 1
          ? { category: 'orthographic' }
          : { confidenceScore: 1 };
    const { response, body } = await json(path, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    assert.equal(response.status, invalid ? 404 : 200);
    const saved = await Sample.findById(record._id);
    assert.equal(saved.errors.length, 2, 'embedded errors remain stable and are never spliced');
    if (!invalid) assert.equal(body.errors[0].written, 'becos');
    return;
  }

  if (useCase === 'UC6') {
    const owner = await student();
    if (number % 3 !== 0) await sampleFor(owner);
    const before = await RecommendationReport.countDocuments();
    const { response } = await json(`/api/students/${owner._id}/recommendations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, number % 3 === 0 ? 422 : 201);
    assert.equal(await RecommendationReport.countDocuments(), number % 3 === 0 ? before : 1);
    return;
  }

  if (useCase === 'UC7') {
    await account();
    const valid = number % 2 === 1;
    const { response, body } = await json('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: valid ? 'Synthetic@DAS' : 'Unknown',
        password: valid ? 'Pass@123' : 'Wrong@123',
      }),
    });
    assert.equal(response.status, valid ? 200 : 401);
    if (valid) {
      assert.equal(body.username, 'Synthetic@DAS');
      assert.equal('passwordHash' in body, false);
    }
    return;
  }

  if (useCase === 'UC8') {
    const record = await account();
    const valid = number % 2 === 1;
    const { response } = await json('/api/auth/change-password', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: record.username,
        currentPassword: valid ? 'Pass@123' : 'wrong',
        newPassword: 'NewPass@456',
      }),
    });
    assert.equal(response.status, valid ? 200 : 401);
    const saved = await Account.findById(record._id);
    assert.equal(
      await bcrypt.compare(valid ? 'NewPass@456' : 'Pass@123', saved.passwordHash),
      true
    );
    return;
  }

  const record = await account();
  const valid = number % 3 === 1;
  record.resetToken = valid ? 'known-token' : number % 3 === 2 ? 'expired-token' : null;
  record.resetTokenExpires = valid ? new Date(Date.now() + 60_000) : new Date(Date.now() - 60_000);
  await record.save();
  const { response } = await json(
    `/api/auth/reset-password/${record.resetToken ?? 'unknown-token'}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: number % 3 === 0 ? 'weak' : 'NewPass@456' }),
    }
  );
  assert.equal(response.status, valid ? 200 : 400);
  const saved = await Account.findById(record._id);
  assert.equal(
    valid
      ? saved.resetToken === null
      : (saved.passwordHash.equals?.(record.passwordHash) ??
          saved.passwordHash === record.passwordHash),
    true
  );
}

describe('LexiPath revised bottom-up integration plan', { concurrency: 1 }, () => {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await RecommendationReport.syncIndexes();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(async () => {
    await Promise.all([
      Account.deleteMany({}),
      RecommendationReport.deleteMany({}),
      Sample.deleteMany({}),
      Student.deleteMany({}),
    ]);
  });

  after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    await mongoose.disconnect();
    await mongo.stop();
  });

  for (const id of ids)
    test(`${id}: real application boundary preserves its sequence invariant`, () => probe(id));
});
