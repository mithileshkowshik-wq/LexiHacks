import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import app from '../app.js';
import { createCloudAccount, readBootstrapSettings } from '../scripts/bootstrapAccount.js';

let server;
let url;
const originalState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (originalState) Object.defineProperty(mongoose.connection, 'readyState', originalState);
  else delete mongoose.connection.readyState;
  await new Promise((resolve) => server.close(resolve));
});

test('readiness requires MongoDB and exposes no account or student data', async () => {
  for (const [state, status, body] of [
    [0, 503, { status: 'unavailable' }],
    [1, 200, { status: 'ok' }],
    [2, 503, { status: 'unavailable' }],
  ]) {
    Object.defineProperty(mongoose.connection, 'readyState', { value: state, configurable: true });
    const response = await fetch(`${url}/healthz`);
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), body);
  }
});

test('cloud bootstrap rejects missing or weak credentials instead of using the demo password', () => {
  assert.throws(() => readBootstrapSettings({}), /are required/);
  assert.throws(
    () =>
      readBootstrapSettings({
        MONGODB_URI: 'mongodb://example.invalid/cloud',
        ADMIN_USERNAME: 'Test',
        ADMIN_EMAIL: 'test@example.invalid',
        ADMIN_PASSWORD: 'weak',
      }),
    /ADMIN_PASSWORD needs/
  );
});

test('cloud bootstrap hashes the password and never changes an existing login', async () => {
  const settings = { username: 'Test', email: 'test@example.invalid', password: 'Synthetic@123' };
  let saved;
  let hashCalls = 0;
  const accountModel = {
    findOne: async () => saved,
    create: async (record) => {
      saved = record;
    },
  };
  const hashPassword = async (password, rounds) => {
    assert.equal(password, settings.password);
    assert.equal(rounds, 12);
    hashCalls += 1;
    return 'synthetic-hash';
  };
  assert.equal(await createCloudAccount(settings, { accountModel, hashPassword }), true);
  assert.equal(saved.passwordHash, 'synthetic-hash');
  assert.equal(Object.hasOwn(saved, 'password'), false);
  assert.equal(
    await createCloudAccount(
      { ...settings, password: 'Changed@123' },
      { accountModel, hashPassword }
    ),
    false
  );
  assert.equal(hashCalls, 1);
  assert.equal(saved.passwordHash, 'synthetic-hash');
});
