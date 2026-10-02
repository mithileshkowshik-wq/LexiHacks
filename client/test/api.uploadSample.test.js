// uploadSample() builds its own fetch() call (FormData can't go through
// request()'s JSON body), which makes it easy for it to silently drift out
// of step with every other authenticated call. It did: requireAuth gates
// POST /api/samples/:studentId same as everything else, but uploadSample
// wasn't sending the Authorization header, so a real upload 401ed before
// createSample ever ran. This locks the fix in place.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { saveSession, clearSession } from '../src/lib/session.js';
import { uploadSample } from '../src/lib/api.js';

function jsonResponse(body, status = 202) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => clearSession());
afterEach(() => {
  clearSession();
  mock.restoreAll();
});

test('sends the session token as a Bearer header alongside the multipart body', async () => {
  saveSession({ token: 'synthetic-jwt' });
  const fetchMock = mock.method(globalThis, 'fetch', async () =>
    jsonResponse({ sampleId: 's1', imageCount: 1 })
  );

  await uploadSample('student-1', {
    title: 'Journal entry',
    taskType: 'ESSAY',
    files: [new File(['bytes'], 'scan.jpg', { type: 'image/jpeg' })],
  });

  assert.equal(fetchMock.mock.calls.length, 1);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.match(url, /\/samples\/student-1$/);
  assert.equal(options.headers.Authorization, 'Bearer synthetic-jwt');
  assert.ok(options.body instanceof FormData);
});

test('omits the header rather than sending "Bearer null" when signed out', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () =>
    jsonResponse({ sampleId: 's1', imageCount: 1 })
  );

  await uploadSample('student-1', {
    title: 'Journal entry',
    taskType: 'ESSAY',
    files: [new File(['bytes'], 'scan.jpg', { type: 'image/jpeg' })],
  });

  const [, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(options.headers, undefined);
});
