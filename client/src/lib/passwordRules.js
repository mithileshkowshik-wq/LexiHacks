// The client-side mirror of server/services/passwordPolicy.js — kept as a
// list of { test, label } so both ResetPasswordPage and AccountPage can
// render the same live checklist instead of duplicating the regexes.

export const PASSWORD_RULES = [
  { test: (value) => value.length >= 8, label: 'At least 8 characters' },
  { test: (value) => /[A-Z]/.test(value), label: 'One capital letter' },
  { test: (value) => /[0-9]/.test(value), label: 'One number' },
  { test: (value) => /[^A-Za-z0-9]/.test(value), label: 'One special character' },
];
