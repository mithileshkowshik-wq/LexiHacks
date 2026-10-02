import test from 'node:test';
import assert from 'node:assert/strict';

import { statusFor } from '../src/lib/status.js';

test('failed analysis is terminal without being report-ready', () => {
  assert.deepEqual(statusFor('FAILED'), {
    label: 'Analysis failed',
    tone: 'failed',
    ready: false,
    failed: true,
  });
});

test('analysed and uploaded statuses are not failures', () => {
  assert.equal(statusFor('ANALYSED').failed, false);
  assert.equal(statusFor('UPLOADED').failed, false);
});
