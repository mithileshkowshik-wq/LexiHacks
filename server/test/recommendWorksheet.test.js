import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { recommendWorksheets } from '../services/recommendWorksheet.js';

const sample = {
  _id: new mongoose.Types.ObjectId(),
  status: 'ANALYSED',
  taskType: 'ESSAY',
  student: {
    currentGrade: 'Secondary 1',
    programme: 'SLP',
    band: 'B',
    programmeYear: 1,
    term: 1,
    week: 4,
  },
  errors: [
    {
      written: 'pali',
      intended: 'pale',
      category: 'phonological',
      note: 'silent e',
      dismissed: false,
    },
    { written: 'frend', intended: 'friend', category: 'orthographic', note: '', dismissed: false },
    {
      written: 'playd',
      intended: 'played',
      category: 'morphological',
      note: 'suffix',
      dismissed: false,
    },
    { written: 'ignore', intended: 'ignored', category: 'morphological', dismissed: true },
  ],
};

test('one sample returns no more than three worksheets based on active errors', async () => {
  let received;
  const engine = {
    async findWorksheets(input, limit) {
      received = { input, limit };
      return [1, 2, 3, 4].map((index) => ({
        worksheetId: `worksheet-${index}`,
        title: `Worksheet ${index}`,
        pdfPath: `_raw/worksheet-${index}.pdf`,
        pdfPages: `${index}`,
        targetCategories: ['phonological'],
        rationale: 'Matches an observed error.',
      }));
    },
  };

  const worksheets = await recommendWorksheets(sample, engine);
  assert.equal(received.limit, 3);
  assert.equal(received.input.errors.length, 3);
  assert.deepEqual(
    received.input.errors.map((error) => error.written),
    ['pali', 'frend', 'playd']
  );
  assert.deepEqual(
    received.input.errors.map((error) => error.id),
    ['error-1', 'error-2', 'error-3']
  );
  assert.equal(
    received.input.errors.some((error) => 'sampleId' in error),
    false
  );
  assert.deepEqual(
    {
      level: received.input.level,
      gradeYear: received.input.gradeYear,
      programme: received.input.programme,
      band: received.input.band,
      programmeYear: received.input.programmeYear,
      term: received.input.term,
      week: received.input.week,
    },
    {
      level: 'secondary',
      gradeYear: 1,
      programme: 'SLP',
      band: 'B',
      programmeYear: 1,
      term: 1,
      week: 4,
    }
  );
  assert.equal(worksheets.length, 3);
});

test('worksheet generation rejects a sample that has not been analysed', async () => {
  await assert.rejects(
    () => recommendWorksheets({ ...sample, status: 'UPLOADED' }, {}),
    (error) => error.statusCode === 422 && error.code === 'SAMPLE_NOT_ANALYSED'
  );
});
