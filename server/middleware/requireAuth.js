// middleware/requireAuth.js
// --------------------------
// The actual enforcement point: mounted in front of every route that should
// require a signed-in caller (see app.js). Everything under /api/auth stays
// unmounted from this - you need to reach login without a token first.
//
// Stateless: verifies the JWT's signature and expiry only, never touches
// Mongo. req.username is the one thing routes can trust afterwards; nothing
// else about the account is attached, so a stale token can't leak stale
// profile data.
//
// The Authorization header is the normal path - every call through
// lib/api.js's request() sends it. It falls back to a ?token= query param
// only when that header is absent, because a couple of routes (sample scan
// images, worksheet PDF downloads) are loaded as a plain <img src> / <a
// href> rather than fetch()'d, and browsers don't let those set custom
// headers. Query-string tokens are more exposed (server access logs,
// browser history) than a header, which is why this is a fallback rather
// than an equally-preferred alternative - client/src/lib/api.js only
// appends it for those two URL-building helpers, nowhere else.

import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function tokenFromRequest(req) {
  const header = req.get('authorization') || '';
  const [scheme, headerToken] = header.split(' ');
  if (scheme === 'Bearer' && headerToken) return headerToken;
  return typeof req.query.token === 'string' ? req.query.token : null;
}

const requireAuth = asyncHandler(async (req, res, next) => {
  const token = tokenFromRequest(req);
  if (!token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to access this resource.');
  }

  try {
    const payload = verifyToken(token);
    req.username = payload.username;
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Your session has expired - sign in again.');
  }

  next();
});

export default requireAuth;
