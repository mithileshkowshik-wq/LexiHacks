import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import app from '../app.js';

let baseUrl;
let server;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

describe('production frontend serving', () => {
  for (const path of ['/', '/login', '/students', '/students/example-student']) {
    test(`GET ${path} serves the React application`, async () => {
      const response = await fetch(`${baseUrl}${path}`);
      const body = await response.text();

      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /^text\/html/);
      assert.match(body, /<div id="root"><\/div>/);
    });
  }

  test('unknown API routes keep the JSON API 404 response', async () => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type'), /^application\/json/);
    assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
    assert.equal(body.error.message, 'API route not found.');
  });
});
