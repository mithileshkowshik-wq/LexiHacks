import assert from 'node:assert/strict';
import test from 'node:test';
import { mongoUriWithDefaultDatabase } from '../config/dbConnection.js';

test('MongoDB URI without a database defaults to lexipath, not Mongo test', () => {
  const uri = mongoUriWithDefaultDatabase(
    'mongodb+srv://user:pass@example.mongodb.net/?retryWrites=true&w=majority'
  );

  assert.equal(
    uri,
    'mongodb+srv://user:pass@example.mongodb.net/lexipath?retryWrites=true&w=majority'
  );
});

test('MongoDB URI with an explicit database is preserved', () => {
  const uri = mongoUriWithDefaultDatabase(
    'mongodb+srv://user:pass@example.mongodb.net/custom?retryWrites=true&w=majority'
  );

  assert.equal(
    uri,
    'mongodb+srv://user:pass@example.mongodb.net/custom?retryWrites=true&w=majority'
  );
});
