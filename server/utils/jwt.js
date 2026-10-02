// utils/jwt.js
// -------------
// Stateless session tokens: signed and verified against JWT_SECRET, never
// stored server-side. Payload only carries the username - everything else
// about an account (name, role, email...) is looked up fresh from Mongo
// wherever it's needed, so the token can't go stale if a profile changes.

import jwt from 'jsonwebtoken';

const DEFAULT_EXPIRES_IN = '24h';

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error('JWT_SECRET is not configured');
  }
  return value;
}

export function signToken(account) {
  return jwt.sign({ username: account.username }, secret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
  });
}

// Throws (jwt.JsonWebTokenError / TokenExpiredError) on anything invalid -
// callers decide how to turn that into an HTTP response.
export function verifyToken(token) {
  return jwt.verify(token, secret());
}
