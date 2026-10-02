import test from 'node:test';
import assert from 'node:assert/strict';

// A fixed secret, set before anything reads it - independent of whatever
// (if anything) is in a real .env, since these tests never touch Mongo or a
// real account either.
process.env.JWT_SECRET ??= 'test-only-secret-do-not-use-in-production';

import app from '../app.js';
import { recommendationEngine } from '../services/recommendationEngine.js';
import { signToken } from '../utils/jwt.js';

const authHeaders = { Authorization: `Bearer ${signToken({ username: 'test-user' })}` };

async function withServer(run) {
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test('worksheet proxy stops oversized chunked PDFs without Content-Length', async () => {
  const originalFetchWorksheet = recommendationEngine.fetchWorksheet;
  recommendationEngine.fetchWorksheet = async (worksheetId) => ({
    worksheet: { worksheetId },
    response: new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('%PDF-'));
          controller.enqueue(new TextEncoder().encode('oversized'));
          controller.close();
        },
      }),
      { headers: { 'Content-Type': 'application/pdf' } }
    ),
    maxBytes: 8,
  });
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/worksheets/approved/file`, {
        headers: authHeaders,
      });
      assert.equal(response.status, 502);
      assert.equal((await response.json()).error.code, 'WORKSHEET_TOO_LARGE');
    });
  } finally {
    recommendationEngine.fetchWorksheet = originalFetchWorksheet;
  }
});
