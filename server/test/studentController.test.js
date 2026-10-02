import test from 'node:test';
import assert from 'node:assert/strict';

import { getStudents } from '../controllers/studentController.js';
import { Student } from '../models/student.js';

test('student list excludes legacy documents missing required display fields', async () => {
  const originalFind = Student.find;
  let filter;

  Student.find = (query) => {
    filter = query;
    return {
      sort: async () => [{ _id: 'valid-id', name: 'Synthetic Student', currentGrade: 'Primary 4' }],
    };
  };

  let payload;
  try {
    await getStudents(
      {},
      {
        json(value) {
          payload = value;
        },
      }
    );
  } finally {
    Student.find = originalFind;
  }

  assert.deepEqual(filter, {
    name: { $type: 'string' },
    currentGrade: { $type: 'string' },
  });
  assert.deepEqual(payload, [
    {
      studentId: 'valid-id',
      name: 'Synthetic Student',
      currentGrade: 'Primary 4',
    },
  ]);
});
