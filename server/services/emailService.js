// services/emailService.js
// --------------------------
// Sends the password-reset email via Resend (https://resend.com). Plain
// fetch against Resend's REST API rather than their SDK — one call, not
// worth a dependency for. `onboarding@resend.dev` is Resend's own shared
// sender, which works without verifying a custom domain first (fine for
// a project like this one; swap EMAIL_FROM once a real domain exists).

const RESEND_API_URL = 'https://api.resend.com/emails';

export async function sendPasswordResetEmail({ to, resetLink }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'LexiPath <onboarding@resend.dev>',
      to,
      subject: 'Reset your LexiPath password',
      html:
        '<p>We received a request to reset your LexiPath password.</p>' +
        `<p><a href="${resetLink}">Click here to choose a new password</a></p>` +
        '<p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>',
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to send the password reset email: ${response.status} ${detail}`);
  }

  return response.json();
}
