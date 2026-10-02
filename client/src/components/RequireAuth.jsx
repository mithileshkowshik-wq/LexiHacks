// Layout-route guard: sits above the app shell in main.jsx so every screen
// under it requires a session. Not real security (see lib/session.js) — the
// API still enforces the signed token; this guard keeps stale localStorage
// shells from rendering protected screens that cannot actually fetch data.
//
// Remembers where the visitor was headed (state.from) so LoginPage.jsx can
// send them back there instead of always landing on the caseload.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getSession } from '../lib/session.js';

export default function RequireAuth() {
  const location = useLocation();

  if (!getSession()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
