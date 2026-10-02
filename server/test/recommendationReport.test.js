import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { RecommendationReport } from '../models/recommendationReport.js';
import { Sample } from '../models/sample.js';

const studentId = new mongoose.Types.ObjectId();
const sampleId = new mongoose.Types.ObjectId();

const strategy = {
  strategy: 'Practise split digraphs',
  rationale: '2 errors include “pali” and “hop”.',
  targetCategories: ['phonological'],
  evidence: [
    {
      category: 'phonological',
      count: 2,
      writtenExamples: ['pali', 'hop'],
      sampleIds: [sampleId],
    },
  ],
  worksheets: [
    {
      worksheetId: 'approved-worksheet',
      title: 'Approved worksheet',
      pdfPath: '_private/internal-path.pdf',
      pageStart: 12,
      pageEnd: 14,
      pdfPages: '12-14',
      available: true,
      targetCategories: ['phonological'],
      rationale: 'Targets the reviewed pattern.',
    },
  ],
};

test('student recommendation report contains only the latest-report fields', async () => {
  assert.equal(
    RecommendationReport.schema.path('student').options.unique,
    true,
    'latest-only reports must enforce one document per student'
  );
  const report = new RecommendationReport({
    student: studentId,
    basedOnSamples: [sampleId],
    strategies: [strategy],
  });
  await report.validate();

  const json = report.toJSON();
  assert.equal(json.status, undefined);
  assert.equal(json.supersedes, undefined);
  assert.equal(json.pendingRegeneration, undefined);
  assert.equal(json.stalenessEvents, undefined);
  assert.equal(json.outdatedFlagDismissedAt, undefined);
  assert.equal(json.student.toString(), studentId.toString());
  assert.equal(json.strategies.length, 1);
  assert.equal(json.strategies[0].worksheets[0].pdfPath, undefined);
  assert.equal(json.strategies[0].worksheets[0].pageStart, 12);
  assert.equal(json.strategies[0].worksheets[0].pageEnd, 14);
  assert.equal(json.strategies[0].worksheets[0].available, true);
  assert.ok(json.reportId);
});

test('sample recommendations preserve the merged multi-page analysis shape', async () => {
  const sample = new Sample({
    student: studentId,
    title: 'Writing sample',
    pages: [{ imagePath: '/private/page.png', originalFilename: 'page.png' }],
    taskType: 'ESSAY',
    status: 'FAILED',
    analysisError: 'The image could not be analysed.',
    errors: [
      {
        written: 'pali',
        confidenceScore: 0.5,
        locationOnScan: { page: 0, x: 0.1, y: 0.2, z: 0.3, w: 0.4 },
      },
    ],
    recommendedWorksheets: [strategy.worksheets[0]],
  });
  await sample.validate();

  assert.equal(sample.pages.length, 1);
  assert.equal(sample.status, 'FAILED');
  assert.equal(sample.errors[0].confidenceScore, 0.5);
  assert.equal(sample.errors[0].locationOnScan.page, 0);
  assert.equal(sample.recommendedWorksheets[0].pdfPath, undefined);
  assert.equal(sample.recommendedWorksheets[0].pageStart, 12);
  assert.equal(sample.recommendedWorksheets[0].pageEnd, 14);
  assert.equal(sample.recommendedWorksheets[0].available, true);
});
