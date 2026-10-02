// The "forgot password" flow (login -> here -> check your email). One
// page, two phases: fill in your username, then a confirmation that a
// reset email is on its way. Mirrors the phase-machine pattern already
// used in UploadSamplePage.jsx.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../lib/api.js';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';

export default function ForgotPasswordPage() {
  const [phase, setPhase] = useState('form'); // form | sent
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset({ username: username.trim() });
      setPhase('sent');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (phase === 'sent') {
    return (
      <div className="auth">
        <section className="analysing" aria-label="Reset email sent">
          <span className="done-mark" aria-hidden="true">
            <Icon name="check" size={28} />
          </span>
          <h1 className="analysing__title">Check your email</h1>
          <p className="analysing__text">
            An email link has been sent to your account to reset your password. Follow the link
            to choose a new one.
          </p>
          <Button variant="secondary" to="/login">
            Back to sign in
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-card__title">Forgot your password?</h1>
        <p className="auth-card__sub">
          Enter your username and we’ll email a reset link to the address on file.
        </p>

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

        {error && <p className="student-form__error">{error}</p>}

        <Button variant="primary" type="submit">
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>

        <Link to="/login" className="auth-card__link">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
