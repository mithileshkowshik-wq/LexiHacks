// Integration tests for the auth routes, mirroring students.integration.test.js:
// Account's Mongoose methods are stubbed against an in-memory array so the
// suite runs without a database, while the real Express app, routes,
// controller and error-handling middleware are exercised over real HTTP.
// The email service is swapped for a spy via node:test's module mocking, so
// no real network call reaches Resend during automated tests.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, mock, test } from 'node:test';
import bcrypt from 'bcryptjs';
import express from 'express';

// A fixed secret, set before anything reads it - login() now signs a token
// on every successful call, independent of whatever (if anything) is in a
// real .env.
process.env.JWT_SECRET ??= 'test-only-secret-do-not-use-in-production';

import errorHandler from '../middleware/errorHandler.js';
import { Account } from '../models/account.js';
import { signToken } from '../utils/jwt.js';

const sentEmails = [];
mock.module('../services/emailService.js', {
  namedExports: {
    sendPasswordResetEmail: async ({ to, resetLink }) => {
      sentEmails.push({ to, resetLink });
      return { id: 'mock-email-id' };
    },
  },
});

// Imported dynamically, after the mock above is registered, so the
// controller (via the router) picks up the mocked email service instead of
// the real one.
const { default: authRoutes } = await import('../routes/auth.js');

const originalFindOne = Account.findOne;

let records;
let server;
let baseUrl;

before(() => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(async () => {
  sentEmails.length = 0;

  const passwordHash = await bcrypt.hash('Pass@123', 4); // low cost factor - fast tests
  records = [
    {
      username: 'Sandy@DAS',
      email: 'sandylim271@gmail.com',
      passwordHash,
      resetToken: null,
      resetTokenExpires: null,
      save: async function save() {
        return this;
      },
    },
  ];

  Account.findOne = async (query) => {
    if (query.username !== undefined) {
      return records.find((account) => account.username === query.username) ?? null;
    }
    if (query.resetToken !== undefined) {
      const now = new Date();
      return (
        records.find(
          (account) =>
            account.resetToken === query.resetToken &&
            account.resetTokenExpires &&
            account.resetTokenExpires > now
        ) ?? null
      );
    }
    return null;
  };
});

after(async () => {
  Account.findOne = originalFindOne;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
});

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: await response.json() };
}

describe('auth API integration', () => {
  test('POST /login succeeds with the correct username and password', async () => {
    const { response, body } = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Sandy@DAS', password: 'Pass@123' }),
    });

    assert.equal(response.status, 200);
    // login() now also signs a session token (server/utils/jwt.js) - checked
    // separately from the account fields since its exact value isn't
    // deterministic across runs.
    const { token, ...account } = body;
    assert.equal(typeof token, 'string');
    assert.ok(token.length > 0);
    assert.deepEqual(account, { username: 'Sandy@DAS', email: 'sandylim271@gmail.com' });
  });

  test('POST /login rejects an unknown username', async () => {
    const { response, body } = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Nobody', password: 'Pass@123' }),
    });

    assert.equal(response.status, 401);
    assert.equal(body.message, 'Incorrect username or password');
  });

  test('POST /login rejects the wrong password', async () => {
    const { response, body } = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Sandy@DAS', password: 'WrongPass@1' }),
    });

    assert.equal(response.status, 401);
    assert.equal(body.message, 'Incorrect username or password');
  });

  test('POST /login rejects a missing password through the error middleware', async () => {
    const { response, body } = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Sandy@DAS' }),
    });

    assert.equal(response.status, 400);
    assert.equal(body.title, 'Validation error');
    assert.equal(body.message, 'Username and password are required');
  });

  test('POST /forgot-password sends a reset email and stores a token for a real account', async () => {
    const { response, body } = await request('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Sandy@DAS' }),
    });

    assert.equal(response.status, 200);
    assert.equal(
      body.message,
      'If that account exists, a reset link has been sent to its email address.'
    );
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, 'sandylim271@gmail.com');
    assert.match(sentEmails[0].resetLink, /\/reset-password\/[0-9a-f]{64}$/);

    assert.equal(typeof records[0].resetToken, 'string');
    assert.ok(records[0].resetTokenExpires > new Date());
  });

  test('POST /forgot-password answers identically for an unknown username, and sends no email', async () => {
    const { response, body } = await request('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Nobody' }),
    });

    assert.equal(response.status, 200);
    assert.equal(
      body.message,
      'If that account exists, a reset link has been sent to its email address.'
    );
    assert.equal(sentEmails.length, 0);
  });

  test('POST /reset-password/:token rejects a weak password without consuming the token', async () => {
    records[0].resetToken = 'abc123';
    records[0].resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

    const { response, body } = await request('/api/auth/reset-password/abc123', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'weak' }),
    });

    assert.equal(response.status, 400);
    assert.match(body.message, /at least 8 characters/);
    assert.equal(records[0].resetToken, 'abc123'); // untouched
  });

  test('POST /reset-password/:token rejects an unknown or expired token', async () => {
    const { response, body } = await request('/api/auth/reset-password/does-not-exist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'NewPass@456' }),
    });

    assert.equal(response.status, 400);
    assert.equal(body.message, 'This reset link is invalid or has expired');
  });

  test('POST /reset-password/:token updates the password and clears the token on success', async () => {
    records[0].resetToken = 'abc123';
    records[0].resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

    const { response, body } = await request('/api/auth/reset-password/abc123', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'NewPass@456' }),
    });

    assert.equal(response.status, 200);
    assert.equal(body.message, 'Your password has been updated.');
    assert.equal(records[0].resetToken, null);
    assert.equal(records[0].resetTokenExpires, null);
    assert.ok(await bcrypt.compare('NewPass@456', records[0].passwordHash));
  });

  test('GET /account requires a session and only ever returns the caller\'s own account', async () => {
    const anonymous = await request('/api/auth/account');
    assert.equal(anonymous.response.status, 401);

    const token = signToken({ username: 'Sandy@DAS' });
    const { response, body } = await request('/api/auth/account', {
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    assert.equal(body.username, 'Sandy@DAS');
    assert.equal(body.email, 'sandylim271@gmail.com');
  });

  test('PATCH /change-password requires a session and acts on whichever account the token belongs to', async () => {
    const anonymous = await request('/api/auth/change-password', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'Pass@123', newPassword: 'NewPass@789' }),
    });
    // Reachable at all only with a session - the old body-supplied `username`
    // is no longer read, so there's nothing to redirect this at any other
    // account even if it were.
    assert.equal(anonymous.response.status, 401);
    assert.ok(await bcrypt.compare('Pass@123', records[0].passwordHash)); // untouched

    const token = signToken({ username: 'Sandy@DAS' });
    const { response, body } = await request('/api/auth/change-password', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword: 'Pass@123', newPassword: 'NewPass@789' }),
    });

    assert.equal(response.status, 200);
    assert.equal(body.message, 'Your password has been updated.');
    assert.ok(await bcrypt.compare('NewPass@789', records[0].passwordHash));
  });
});
