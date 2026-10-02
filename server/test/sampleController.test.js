import test from 'node:test';
import assert from 'node:assert/strict';

import { markReviewed, reclassifyError } from '../controllers/sampleController.js';
import { Sample } from '../models/sample.js';

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
  };
}

test('dismissal-only error updates save once and return the full sample', async () => {
  const originalFindById = Sample.findById;
  let saves = 0;
  const sample = {
    _id: 'sample-1',
    student: 'student-1',
    title: 'Writing',
    taskType: 'ESSAY',
    status: 'ANALYSED',
    pages: [{ imagePath: '/private/page.png' }],
    errors: [{ written: 'hop', category: 'phonological', dismissed: false }],
    save: async () => {
      saves += 1;
    },
  };
  Sample.findById = async () => sample;
  try {
    const res = responseRecorder();
    await reclassifyError(
      { params: { sampleId: 'sample-1', errorIndex: '0' }, body: { dismissed: true } },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(sample.errors[0].dismissed, true);
    assert.equal(sample.errors[0].category, 'phonological');
    assert.equal(saves, 1);
    assert.equal(res.payload.errors[0].dismissed, true);
  } finally {
    Sample.findById = originalFindById;
  }
});

test('confidence-only error updates preserve category and dismissal state', async () => {
  const originalFindById = Sample.findById;
  const sample = {
    _id: 'sample-1',
    student: 'student-1',
    title: 'Writing',
    taskType: 'ESSAY',
    status: 'ANALYSED',
    pages: [{ imagePath: '/private/page.png' }],
    errors: [
      {
        written: 'hop',
        category: 'phonological',
        confidenceScore: 0.4,
        dismissed: false,
      },
    ],
    save: async () => {},
  };
  Sample.findById = async () => sample;
  try {
    const res = responseRecorder();
    await reclassifyError(
      { params: { sampleId: 'sample-1', errorIndex: '0' }, body: { confidenceScore: 1 } },
      res
    );

    assert.equal(sample.errors[0].confidenceScore, 1);
    assert.equal(sample.errors[0].category, 'phonological');
    assert.equal(sample.errors[0].dismissed, false);
  } finally {
    Sample.findById = originalFindById;
  }
});

test('error index "new" appends an educator-identified error', async () => {
  const originalFindById = Sample.findById;
  let saves = 0;
  const sample = {
    _id: 'sample-1',
    student: 'student-1',
    title: 'Writing',
    taskType: 'ESSAY',
    status: 'ANALYSED',
    pages: [{ imagePath: '/private/page.png' }],
    errors: [],
    save: async () => {
      saves += 1;
    },
  };
  Sample.findById = async () => sample;
  try {
    const res = responseRecorder();
    await reclassifyError(
      {
        params: { sampleId: 'sample-1', errorIndex: 'new' },
        body: { written: 'becos', category: 'phonological' },
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(sample.errors, [
      {
        written: 'becos',
        category: 'phonological',
        confidenceScore: 1,
        dismissed: false,
      },
    ]);
    assert.equal(saves, 1);
    assert.equal(res.payload.errors[0].errorIndex, 0);
    assert.equal(res.payload.statistics.total, 1);
  } finally {
    Sample.findById = originalFindById;
  }
});

test('error updates reject an out-of-range embedded error index', async () => {
  const originalFindById = Sample.findById;
  Sample.findById = async () => ({ errors: [] });
  try {
    const res = responseRecorder();
    await assert.rejects(
      reclassifyError(
        { params: { sampleId: 'sample-1', errorIndex: '4' }, body: { dismissed: true } },
        res
      ),
      /Error not found/
    );
    assert.equal(res.statusCode, 404);
  } finally {
    Sample.findById = originalFindById;
  }
});

test('mark reviewed rejects unsupported status values before saving', async () => {
  const originalFindById = Sample.findById;
  let saved = false;
  Sample.findById = async () => ({
    status: 'ANALYSED',
    save: async () => {
      saved = true;
    },
  });
  try {
    const res = responseRecorder();
    await assert.rejects(
      markReviewed({ params: { sampleId: 'sample-1' }, body: { status: 'NOT_A_STATUS' } }, res),
      /body usage incorrect/
    );
    assert.equal(res.statusCode, 400);
    assert.equal(saved, false);
  } finally {
    Sample.findById = originalFindById;
  }
});
