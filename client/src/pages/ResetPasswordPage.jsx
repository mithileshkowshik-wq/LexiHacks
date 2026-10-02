// The "choose a new password" screen, reached from the emailed reset link
// (/reset-password/:token). Validates the new password against the same
// rule the server enforces (services/passwordPolicy.js on the server) —
// at least 8 characters, one capital letter, one number, one special
// character — so the checklist updates live instead of only failing on
// submit.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { resetPassword } from '../lib/api.js';
import { PASSWORD_RULES } from '../lib/passwordRules.js';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';
import PasswordRulesList from '../components/PasswordRulesList.jsx';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phase, setPhase] = useState('form'); // form | done
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
      await resetPassword(token, { password });
      setPhase('done');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (phase === 'done') {
    return (
      <div className="auth">
        <section className="analysing" aria-label="Password updated">
          <span className="done-mark" aria-hidden="true">
            <Icon name="check" size={28} />
          </span>
          <h1 className="analysing__title">Password updated</h1>
          <p className="analysing__text">
            Your password has been changed. Sign in with your new password to continue.
          </p>
          <Button variant="primary" to="/login">
            Back to sign in
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-card__title">Choose a new password</h1>
        <p className="auth-card__sub">Your new password must meet every rule below.</p>

        <label className="field">
          <span className="field__label">New password</span>
          <input
            className="field__input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Confirm new password</span>
          <input
            className="field__input"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
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
          disabledHint={unmet.length > 0 ? 'Meet every password rule first' : 'Passwords must match'}
        >
          {submitting ? 'Updating…' : 'Update password'}
        </Button>

        <Link to="/login" className="auth-card__link">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
