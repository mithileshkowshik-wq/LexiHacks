// The create-account screen. Open sign-up: anyone can register, and the
// server answers with a session token so the new user lands signed in.
// Same standalone auth-card layout as LoginPage, and the same live password
// checklist as ResetPasswordPage (mirrors server/services/passwordPolicy.js).

import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { register } from '../lib/api.js';
import { getSession, saveSession } from '../lib/session.js';
import { PASSWORD_RULES } from '../lib/passwordRules.js';
import Button from '../components/Button.jsx';
import Logo from '../components/Logo.jsx';
import PasswordRulesList from '../components/PasswordRulesList.jsx';

export default function SignupPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (getSession()) {
    return <Navigate to="/" replace />;
  }

  const unmet = PASSWORD_RULES.filter((rule) => !rule.test(password));
  const touchedConfirm = confirm.length > 0;
  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = unmet.length === 0 && passwordsMatch && !submitting;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const account = await register({ username: username.trim(), email: email.trim(), password });
      saveSession(account);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={handleSubmit}>
        <Logo size={32} className="auth-card__mark" />
        <h1 className="auth-card__title">Create an account</h1>
        <p className="auth-card__sub">You’ll use your username and password to sign in.</p>

        <label className="field">
          <span className="field__label">Username</span>
          <input
            className="field__input"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="e.g. Name@DAS"
            autoComplete="username"
            autoFocus
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="field__input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@school.edu"
            autoComplete="email"
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
            autoComplete="new-password"
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Confirm password</span>
          <input
            className="field__input"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        <PasswordRulesList password={password} />

        {touchedConfirm && !passwordsMatch && (
          <p className="student-form__error">Passwords don’t match.</p>
        )}
        {error && <p className="student-form__error">{error}</p>}

        <Button
          variant="primary"
          type="submit"
          disabled={!canSubmit}
          disabledHint={
            unmet.length > 0 ? 'Meet every password rule first' : 'Passwords must match'
          }
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>

        <Link to="/login" className="auth-card__link">
          Already have an account? Sign in
        </Link>
      </form>
    </div>
  );
}
