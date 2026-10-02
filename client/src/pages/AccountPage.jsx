// The signed-in therapist's own account — name/email/phone/role/org, member
// since date, and a change-password form. Distinct from StudentProfilePage,
// which is a *student's* record, not the logged-in user's own.
//
// Reads who's signed in from lib/session.js (set by LoginPage on success).
// RequireAuth.jsx already gates this route, so the "you're not signed in"
// fallback below is defensive rather than a real code path — same reasoning
// as Sidebar.jsx's placeholder identity.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccount, changePassword } from '../lib/api.js';
import { getSession, clearSession } from '../lib/session.js';
import { PASSWORD_RULES } from '../lib/passwordRules.js';
import Button from '../components/Button.jsx';
import PasswordRulesList from '../components/PasswordRulesList.jsx';

export default function AccountPage() {
  const navigate = useNavigate();
  const session = getSession();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (!session) return undefined;
    let live = true;
    getAccount()
      .then((account) => live && setState({ status: 'ready', account }))
      .catch((err) => live && setState({ status: 'error', message: err.message }));
    return () => {
      live = false;
    };
  }, [session?.username]);

  function handleSignOut() {
    clearSession();
    navigate('/login');
  }

  if (!session) {
    return (
      <div className="feedback">
        <h2 className="feedback__title">You’re not signed in</h2>
        <p className="feedback__text">Sign in to view your account details.</p>
        <Button variant="primary" to="/login">
          Sign in
        </Button>
      </div>
    );
  }

  if (state.status === 'loading') {
    return <div className="skel skel--row" aria-hidden="true" />;
  }

  if (state.status === 'error') {
    return <p className="feedback__text feedback--error">{state.message}</p>;
  }

  const { account } = state;

  return (
    <div className="profile">
      <header className="profile__head">
        <div className="profile__id">
          <span className="eyebrow">My account</span>
          <h1 className="profile__name">{account.name || account.username}</h1>
          {account.role && <span className="grade">{account.role}</span>}
        </div>
        <div className="profile__actions">
          <Button variant="secondary" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>

      <AccountDetails account={account} />
      <ChangePasswordForm />
    </div>
  );
}

function AccountDetails({ account }) {
  const rows = [
    { label: 'Username', value: account.username },
    { label: 'Email', value: account.email },
    { label: 'Phone number', value: account.phoneNumber || '—' },
    { label: 'Organisation', value: account.organisation || '—' },
    {
      label: 'Member since',
      value: account.createdAt
        ? new Date(account.createdAt).toLocaleDateString('en-SG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '—',
    },
  ];

  return (
    <section className="account-details" aria-label="Account details">
      <h2 className="account-details__title">Account details</h2>
      <dl className="account-details__list">
        {rows.map((row) => (
          <div key={row.label} className="account-details__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const unmet = PASSWORD_RULES.filter((rule) => !rule.test(newPassword));
  const touchedConfirm = confirm.length > 0;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirm;
  const canSubmit =
    currentPassword.length > 0 && unmet.length === 0 && passwordsMatch && !submitting;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await changePassword({ currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="student-form" onSubmit={handleSubmit}>
      <h2 className="student-form__title">Change password</h2>
      <div className="student-form__fields">
        <label className="field">
          <span className="field__label">Current password</span>
          <input
            className="field__input"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field__label">New password</span>
          <input
            className="field__input"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
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
      </div>

      <PasswordRulesList password={newPassword} />

      {touchedConfirm && !passwordsMatch && (
        <p className="student-form__error">New passwords don’t match.</p>
      )}
      {error && <p className="student-form__error">{error}</p>}
      {success && <p className="account-details__success">Password updated.</p>}

      <div className="student-form__actions">
        <Button
          variant="primary"
          type="submit"
          disabled={!canSubmit}
          disabledHint={
            currentPassword.length === 0
              ? 'Enter your current password first'
              : unmet.length > 0
                ? 'Meet every password rule first'
                : 'Passwords must match'
          }
        >
          {submitting ? 'Updating…' : 'Update password'}
        </Button>
      </div>
    </form>
  );
}
