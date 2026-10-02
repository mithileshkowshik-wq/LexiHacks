import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { generateReport } from '../services/generateReport.js';

const student = {
  _id: new mongoose.Types.ObjectId(),
  name: 'DAS-PRIVATE',
  currentGrade: 'Primary 4',
  programme: 'SLP',
  band: 'B',
  programmeYear: 1,
  term: 1,
  week: 4,
};

const samples = [
  {
    _id: new mongoose.Types.ObjectId(),
    status: 'ANALYSED',
    taskType: 'ESSAY',
    imagePath: '/private/a.png',
    errors: [{ written: 'pali', intended: 'pale', category: 'phonological', dismissed: false }],
  },
  {
    _id: new mongoose.Types.ObjectId(),
    status: 'REVIEWED',
    taskType: 'ESSAY',
    imagePath: '/private/b.png',
    errors: [{ written: 'playd', intended: 'played', category: 'morphological', dismissed: false }],
  },
  {
    _id: new mongoose.Types.ObjectId(),
    status: 'UPLOADED',
    taskType: 'ESSAY',
    imagePath: '/private/c.png',
    errors: [{ written: 'unused', category: 'unsure', dismissed: false }],
  },
];

test('student report uses all analysed samples and excludes identity and file paths', async () => {
  let received;
  const engine = {
    async createInterventionStrategies(input) {
      received = input;
      return [
        {
          strategy: 'Teach the repeated patterns',
          rationale: 'Evidence includes “pali” and “playd”.',
          targetCategories: ['phonological', 'morphological'],
          evidence: [],
        },
      ];
    },
  };

  const report = await generateReport(student, samples, engine);
  assert.deepEqual(
    report.basedOnSamples.map(String),
    samples.slice(0, 2).map((sample) => String(sample._id))
  );
  assert.equal(report.strategies.length, 1);
  assert.deepEqual(
    received.errors.map((error) => error.written),
    ['pali', 'playd']
  );
  assert.doesNotMatch(JSON.stringify(received), /DAS-PRIVATE|private\/a|private\/b/);
  assert.deepEqual(
    {
      level: received.level,
      gradeYear: received.gradeYear,
      programme: received.programme,
      band: received.band,
      programmeYear: received.programmeYear,
      term: received.term,
      week: received.week,
    },
    {
      level: 'primary',
      gradeYear: 4,
      programme: 'SLP',
      band: 'B',
      programmeYear: 1,
      term: 1,
      week: 4,
    }
  );
});

test('student report rejects students without analysed errors', async () => {
  await assert.rejects(
    () => generateReport(student, samples.slice(2), {}),
    (error) => error.statusCode === 422 && error.code === 'NO_ACTIVE_ERRORS'
  );
});
