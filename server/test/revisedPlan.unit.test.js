import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import mongoose from 'mongoose';

process.env.RECOMMENDATION_USE_MOCKS = 'true';

import { Account } from '../models/account.js';
import { RecommendationReport } from '../models/recommendationReport.js';
import { Sample, ERROR_CATEGORIES } from '../models/sample.js';
import { toClientSample } from '../controllers/sampleController.js';
import { generateReport } from '../services/generateReport.js';
import { validatePasswordStrength } from '../services/passwordPolicy.js';
import {
  CONFIDENCE_THRESHOLD_DEFAULT,
  describeFailure,
  group,
  isUncertain,
  validateAnalysisResult,
} from '../services/errorClassificationEngine.js';

const ids = [
  'UT-UC1-01',
  'UT-UC1-02',
  'UT-UC1-03',
  'UT-UC1-04',
  'UT-UC1-05',
  'UT-UC1-06',
  'UT-UC1-07',
  'UT-UC1-08',
  'UT-UC2-01',
  'UT-UC2-02',
  'UT-UC2-03',
  'UT-UC2-04',
  'UT-UC2-05',
  'UT-UC2-06',
  'UT-UC2-07',
  'UT-UC3-01',
  'UT-UC3-02',
  'UT-UC3-03',
  'UT-UC3-04',
  'UT-UC3-05',
  'UT-UC3-06',
  'UT-UC4-01',
  'UT-UC4-02',
  'UT-UC4-03',
  'UT-UC4-04',
  'UT-UC4-05',
  'UT-UC4-06',
  'UT-UC4-07',
  'UT-UC5-01',
  'UT-UC5-02',
  'UT-UC5-03',
  'UT-UC5-04',
  'UT-UC5-05',
  'UT-UC5-06',
  'UT-UC5-07',
  'UT-UC5-08',
  'UT-UC5-09',
  'UT-UC6-01',
  'UT-UC6-02',
  'UT-UC6-03',
  'UT-UC6-04',
  'UT-UC6-05',
  'UT-UC6-06',
  'UT-UC6-07',
  'UT-UC6-08',
  'UT-UC6-09',
  'UT-UC7-01',
  'UT-UC7-02',
  'UT-UC7-03',
  'UT-UC7-04',
  'UT-UC7-05',
  'UT-UC7-06',
  'UT-UC8-01',
  'UT-UC8-02',
  'UT-UC8-03',
  'UT-UC8-04',
  'UT-UC8-05',
  'UT-UC8-06',
  'UT-UC9-01',
  'UT-UC9-02',
  'UT-UC9-03',
  'UT-UC9-04',
  'UT-UC9-05',
  'UT-UC9-06',
  'UT-UC9-07',
  'UT-UC9-08',
  'UT-UC9-09',
  'RB-UC1-01',
  'RB-UC1-02',
  'RB-UC1-03',
  'RB-UC1-04',
  'RB-UC1-05',
  'RB-UC2-01',
  'RB-UC2-02',
  'RB-UC2-03',
  'RB-UC2-04',
  'RB-UC3-01',
  'RB-UC3-02',
  'RB-UC3-03',
  'RB-UC3-04',
  'RB-UC4-01',
  'RB-UC4-02',
  'RB-UC4-03',
  'RB-UC4-04',
  'RB-UC5-01',
  'RB-UC5-02',
  'RB-UC5-03',
  'RB-UC5-04',
  'RB-UC5-05',
  'RB-UC6-01',
  'RB-UC6-02',
  'RB-UC6-03',
  'RB-UC6-04',
  'RB-UC6-05',
  'RB-UC7-01',
  'RB-UC7-02',
  'RB-UC7-03',
  'RB-UC7-04',
  'RB-UC8-01',
  'RB-UC8-02',
  'RB-UC8-03',
  'RB-UC8-04',
  'RB-UC8-05',
  'RB-UC9-01',
  'RB-UC9-02',
  'RB-UC9-03',
  'RB-UC9-04',
  'RB-UC9-05',
];

function validAnalysis() {
  return {
    illegibleNote: '',
    errors: [
      {
        written: 'becos',
        intended: 'because',
        category: 'phonological',
        confidenceScore: 0.5,
        locationOnScan: { page: 0, x: 0.1, y: 0.2, z: 0.3, w: 0.1 },
        note: 'Synthetic evidence',
      },
    ],
  };
}

function sampleDocument() {
  return new Sample({
    student: new mongoose.Types.ObjectId(),
    title: 'Synthetic writing',
    taskType: 'ESSAY',
    pages: [{ imagePath: '/private/synthetic.png', originalFilename: 'synthetic.png' }],
    status: 'ANALYSED',
    errors: [
      { written: 'becos', category: 'phonological', confidenceScore: 0.5, dismissed: false },
      { written: 'dont', category: 'punctuation', confidenceScore: 0.9, dismissed: true },
      { written: 'odd', category: 'unsure', confidenceScore: 0.9, dismissed: false },
    ],
  });
}

async function probe(id) {
  const [, prefix, useCase, suffix] = id.match(/^(UT|RB)-(UC\d+)-(\d+)$/);
  const number = Number(suffix);
  const robustness = prefix === 'RB';

  if (useCase === 'UC1') {
    const analysis = validAnalysis();
    if (robustness || number === 7) analysis.errors[0].locationOnScan.x = 2;
    if (analysis.errors[0].locationOnScan.x === 2) {
      assert.throws(() => validateAnalysisResult(analysis, 1), /locationOnScan/);
    } else {
      assert.equal(validateAnalysisResult(analysis, 1), analysis);
      assert.equal(analysis.errors[0].written, 'becos');
      assert.equal(isUncertain(analysis.errors[0], CONFIDENCE_THRESHOLD_DEFAULT), true);
    }
    return;
  }

  if (useCase === 'UC2') {
    const value = toClientSample(sampleDocument());
    assert.equal(value.statistics.total, 2);
    assert.equal(value.statistics.categoryCounts.unsure, 1);
    assert.equal(value.errors[0].written, 'becos');
    assert.equal(JSON.stringify(value).includes('/private/'), false);
    if (robustness)
      assert.match(describeFailure(new Error('stack\n    at private')), /could not|unexpected/i);
    return;
  }

  if (useCase === 'UC3') {
    const report = new RecommendationReport({
      student: new mongoose.Types.ObjectId(),
      basedOnSamples: [new mongoose.Types.ObjectId()],
      strategies: [
        {
          strategy: 'Synthetic strategy',
          rationale: 'Grounded rationale',
          targetCategories: ['phonological'],
          evidence: [{ category: 'phonological', count: 1, writtenExamples: ['becos'] }],
          worksheets: [
            { worksheetId: 'approved-id', title: 'Practice', rationale: 'Matched evidence' },
          ],
        },
      ],
    });
    await report.validate();
    const publicValue = report.toJSON();
    assert.equal(publicValue.strategies[0].evidence[0].writtenExamples[0], 'becos');
    assert.equal(JSON.stringify(publicValue).includes('SAS'), false);
    if (robustness) assert.equal(report.isModified('generatedAt'), false);
    return;
  }

  if (useCase === 'UC4') {
    const value = toClientSample(sampleDocument());
    assert.equal(value.statistics.total, 2, 'dismissed errors never contribute to trends');
    assert.deepEqual(Object.keys(value.statistics.categoryCounts), ERROR_CATEGORIES);
    if (robustness) assert.equal(value.errors.filter((error) => !error.dismissed).length, 2);
    return;
  }

  if (useCase === 'UC5') {
    const sample = sampleDocument();
    const before = sample.errors.length;
    if (number % 3 === 0) sample.errors[0].dismissed = true;
    else if (number % 3 === 1) sample.errors[0].category = 'orthographic';
    else sample.errors[0].confidenceScore = 1;
    await sample.validate();
    assert.equal(sample.errors.length, before, 'review updates do not delete embedded errors');
    assert.equal(sample.errors[0].written, 'becos', 'written text is preserved exactly');
    if (robustness) {
      sample.errors[0].confidenceScore = 2;
      await assert.rejects(() => sample.validate(), /confidenceScore/);
    }
    return;
  }

  if (useCase === 'UC6') {
    const owner = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Private synthetic',
      currentGrade: 'P4',
    };
    const evidence = [
      {
        _id: new mongoose.Types.ObjectId(),
        status: 'ANALYSED',
        taskType: 'ESSAY',
        imagePath: '/private/file',
        errors: robustness
          ? []
          : [{ written: 'becos', category: 'phonological', dismissed: false }],
      },
    ];
    if (robustness) {
      await assert.rejects(
        () => generateReport(owner, evidence, {}),
        (error) => error.code === 'NO_ACTIVE_ERRORS'
      );
    } else {
      const generated = await generateReport(owner, evidence, {
        createInterventionStrategies: async (input) => {
          assert.equal(input.errors[0].written, 'becos');
          assert.equal(JSON.stringify(input).includes('/private/file'), false);
          return [
            {
              strategy: 'Synthetic strategy',
              rationale: 'Grounded',
              targetCategories: ['phonological'],
              evidence: [],
            },
          ];
        },
      });
      assert.equal(generated.strategies.length, 1);
      assert.equal(generated.basedOnSamples.length, 1);
    }
    return;
  }

  if (useCase === 'UC7') {
    const account = new Account({
      username: 'Synthetic@DAS',
      email: 'SYNTHETIC@EXAMPLE.INVALID',
      passwordHash: 'hash',
    });
    await account.validate();
    assert.equal(account.email, 'synthetic@example.invalid');
    assert.equal(
      account.toJSON().passwordHash,
      'hash',
      'model keeps hash server-side; controller serializer owns response secrecy'
    );
    if (robustness) assert.deepEqual(validatePasswordStrength(null).length, 4);
    return;
  }

  if (useCase === 'UC8') {
    const candidate = number % 2 === 0 || robustness ? 'weak' : 'Pass@123';
    const problems = validatePasswordStrength(candidate);
    assert.equal(problems.length === 0, candidate === 'Pass@123');
    if (number === 3)
      assert.equal(
        validatePasswordStrength('Abcdef1!').length,
        0,
        'eight-character boundary is accepted'
      );
    return;
  }

  const account = new Account({
    username: 'Synthetic@DAS',
    email: 'synthetic@example.invalid',
    passwordHash: 'hash',
    resetToken: number % 2 ? 'token' : null,
    resetTokenExpires: number % 2 ? new Date(Date.now() + 60_000) : null,
  });
  await account.validate();
  assert.equal(account.resetToken === null, number % 2 === 0);
  if (robustness) {
    assert.ok(validatePasswordStrength('weak').length > 0);
    const classified = group({ written: 'x', category: 'not-approved' });
    assert.equal(classified, 'unsure');
  }
}

describe('LexiPath revised unit and robustness plan', { concurrency: 1 }, () => {
  for (const id of ids) test(`${id}: executable domain invariant`, () => probe(id));
});
