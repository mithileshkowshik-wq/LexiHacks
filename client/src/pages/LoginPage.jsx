// The sign-in screen. Stands alone outside the app shell (no sidebar) —
// same visual language as the rest of LexiPath (paper/surface tokens, the
// shared .field/.btn primitives), but this screen exists before the app's
// internal navigation is relevant.
//
// Every other page is gated behind a session now (RequireAuth.jsx), so this
// is effectively the app's front door — signing in here checks real
// credentials against the server, but that gate is client-side only, not
// real API security (see server/README.md's Authentication section for the
// deliberate scope cut).

import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../lib/api.js';
import { getSession, saveSession } from '../lib/session.js';
import Button from '../components/Button.jsx';
import Logo from '../components/Logo.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (e.g. followed an old bookmark to /login) — nothing to
  // do here, so skip straight past the form.
  if (getSession()) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const account = await login({ username: username.trim(), password });
      saveSession(account);
      // RequireAuth stashes where the visitor was actually headed before
      // bouncing them here — send them back to it instead of always the
      // caseload, so a deep link (or "Session expired") doesn't lose their place.
      navigate(location.state?.from?.pathname ?? '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={handleSubmit}>
        <Logo size={32} className="auth-card__mark" />
        <h1 className="auth-card__title">Sign in to LexiPath</h1>
        <p className="auth-card__sub">Enter your username and password to continue.</p>

        <label className="field">
          <span className="field__label">Username</span>
          <input
            className="field__input"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="e.g. Name@DAS"
            autoFocus
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input
            className="field__input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="password"
            required
          />
        </label>

        {error && <p className="student-form__error">{error}</p>}

        <Button variant="primary" type="submit">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>

        <Link to="/forgot-password" className="auth-card__link">
          Forgot password?
        </Link>
      </form>
    </div>
  );
}
