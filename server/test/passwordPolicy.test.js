import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { validatePasswordStrength } from '../services/passwordPolicy.js';

describe('validatePasswordStrength', () => {
  test('accepts a password meeting every rule', () => {
    assert.deepEqual(validatePasswordStrength('Pass@123'), []);
  });

  test('reports every unmet rule at once, not just the first', () => {
    assert.deepEqual(validatePasswordStrength('weak'), [
      'at least 8 characters',
      'at least one capital letter',
      'at least one number',
      'at least one special character',
    ]);
  });

  test('rejects a password missing only a capital letter', () => {
    assert.deepEqual(validatePasswordStrength('lower@123'), ['at least one capital letter']);
  });

  test('rejects a password missing only a number', () => {
    assert.deepEqual(validatePasswordStrength('NoNumber@'), ['at least one number']);
  });

  test('rejects a password missing only a special character', () => {
    assert.deepEqual(validatePasswordStrength('NoSpecial1'), ['at least one special character']);
  });

  test('rejects a password one character short of the minimum length', () => {
    assert.deepEqual(validatePasswordStrength('Sh0rt@1'), ['at least 8 characters']);
  });

  test('accepts a password exactly at the length boundary', () => {
    assert.deepEqual(validatePasswordStrength('Ab1@abcd'), []);
  });

  test('treats non-string input as failing every rule rather than throwing', () => {
    assert.deepEqual(validatePasswordStrength(undefined), [
      'at least 8 characters',
      'at least one capital letter',
      'at least one number',
      'at least one special character',
    ]);
  });
});
