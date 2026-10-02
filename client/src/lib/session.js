// Minimal client-side "who's signed in" state, persisted to localStorage so
// it survives a reload. RequireAuth.jsx reads getSession() to gate every
// route except /login, /forgot-password and /reset-password/:token.
//
// The stored object is exactly what POST /api/auth/login returns - the
// account fields plus a signed `token` (server/utils/jwt.js). That token is
// what actually gates the API now (server/middleware/requireAuth.js reads
// and verifies it on every protected route); lib/api.js's request() helper
// reads it back via getToken() and sends it as an Authorization header.

const KEY = 'lexipath.session';

export function saveSession(account) {
  localStorage.setItem(KEY, JSON.stringify(account));
}

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    const session = raw ? JSON.parse(raw) : null;
    if (session && !session.token) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function getToken() {
  return getSession()?.token ?? null;
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
