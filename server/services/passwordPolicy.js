// services/passwordPolicy.js
// ---------------------------
// The one password-strength rule enforced everywhere a password is set:
// at least 8 characters, one capital letter, one number and one special
// character. Kept as a single pure function so the server (source of
// truth) and any client-side validation stay checking the exact same
// rule rather than two hand-copied regexes drifting apart.

export function validatePasswordStrength(password) {
  const problems = [];
  const value = typeof password === 'string' ? password : '';

  if (value.length < 8) problems.push('at least 8 characters');
  if (!/[A-Z]/.test(value)) problems.push('at least one capital letter');
  if (!/[0-9]/.test(value)) problems.push('at least one number');
  if (!/[^A-Za-z0-9]/.test(value)) problems.push('at least one special character');

  return problems;
}
