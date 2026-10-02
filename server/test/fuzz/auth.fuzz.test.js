import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, mock, test } from 'node:test';
import bcrypt from 'bcryptjs';
import express from 'express';
import fc from 'fast-check';

process.env.JWT_SECRET ??= 'test-only-secret-do-not-use-in-production';

import errorHandler from '../../middleware/errorHandler.js';
import { Account } from '../../models/account.js';

// Prevent real email calls during fuzzing
mock.module('../../services/emailService.js', {
  namedExports: {
    sendPasswordResetEmail: async () => ({ id: 'mock-email-id' }),
  },
});

// Import after mock registration
const { default: authRoutes } = await import('../../routes/auth.js');

const originalFindOne = Account.findOne;

let records;
let server;
let baseUrl;

before(() => {
  const app = express();

  // Same basic setup as your existing auth integration test
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);

  server = app.listen(0);

  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(async () => {
  const passwordHash = await bcrypt.hash('Pass@123', 4);

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

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);

  let body = null;

  try {
    body = await response.json();
  } catch {
    // Some malformed requests may not produce JSON.
  }

  return { response, body };
}

describe('authentication fuzz testing', () => {
  test('random malformed JWTs never crash protected account route', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 5000 }),

        async (token) => {
          const { response } = await request('/api/auth/account', {
            headers: {
              authorization: `Bearer ${token}`,
            },
          });

          // Invalid JWT input must never cause an uncontrolled server failure
          assert.notEqual(
            response.status,
            500,
            `Malformed JWT caused HTTP 500: ${JSON.stringify(token)}`
          );

          // Random strings should normally be rejected as unauthenticated
          assert.ok(
            response.status === 401 || response.status === 200,
            `Unexpected status ${response.status} for token ${JSON.stringify(token)}`
          );
        }
      ),
      {
        numRuns: 1000,
      }
    );
  });

  test('random usernames and passwords never crash login', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 1000 }),
        fc.string({ maxLength: 1000 }),

        async (username, password) => {
          const { response } = await request('/api/auth/login', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              username,
              password,
            }),
          });

          assert.notEqual(
            response.status,
            500,
            `Login caused HTTP 500 for username=${JSON.stringify(username)}`
          );

          assert.ok(
            [200, 400, 401].includes(response.status),
            `Unexpected login status ${response.status}`
          );
        }
      ),
      {
        numRuns: 1000,
      }
    );
  });

  test('missing or malformed login fields are rejected safely', async () => {
    const malformedBodyArbitrary = fc.oneof(
      fc.constant({}),
      fc.record({
        username: fc.string(),
      }),
      fc.record({
        password: fc.string(),
      }),
      fc.record({
        username: fc.constant(null),
        password: fc.string(),
      }),
      fc.record({
        username: fc.string(),
        password: fc.constant(null),
      }),
      fc.record({
        username: fc.integer(),
        password: fc.string(),
      }),
      fc.record({
        username: fc.string(),
        password: fc.array(fc.string()),
      })
    );

    await fc.assert(
      fc.asyncProperty(
        malformedBodyArbitrary,

        async (body) => {
          const { response } = await request('/api/auth/login', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          assert.notEqual(
            response.status,
            500,
            `Malformed login body caused HTTP 500: ${JSON.stringify(body)}`
          );

          assert.ok(
            [400, 401].includes(response.status),
            `Unexpected status ${response.status} for malformed body`
          );
        }
      ),
      {
        numRuns: 500,
      }
    );
  });

  test('random password reset tokens never crash reset endpoint', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 1000 }),
        fc.string({ maxLength: 500 }),

        async (token, password) => {
          const encodedToken = encodeURIComponent(token);

          const { response } = await request(`/api/auth/reset-password/${encodedToken}`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              password,
            }),
          });

          assert.notEqual(
            response.status,
            500,
            `Reset token caused HTTP 500: ${JSON.stringify(token)}`
          );

          assert.ok(
            [400, 404, 200].includes(response.status),
            `Unexpected reset status ${response.status}`
          );
        }
      ),
      {
        numRuns: 500,
      }
    );
  });
});
