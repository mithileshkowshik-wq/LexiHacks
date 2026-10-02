import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Account } from '../models/account.js';
import { validatePasswordStrength } from '../services/passwordPolicy.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { signToken } from '../utils/jwt.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const SALT_ROUNDS = 10;

// The client shape for an account. Every route in this file answers with
// this instead of the raw Mongoose document, so passwordHash/resetToken
// never reach the browser.
const toClientAccount = (account) => ({
  username: account.username,
  name: account.name,
  email: account.email,
  phoneNumber: account.phoneNumber,
  role: account.role,
  organisation: account.organisation,
  createdAt: account.createdAt,
});

const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400);
    throw new Error('Username and password are required');
  }

  const account = await Account.findOne({ username });
  const passwordMatches = account && (await bcrypt.compare(password, account.passwordHash));
  if (!passwordMatches) {
    res.status(401);
    throw new Error('Incorrect username or password');
  }

  res.status(200).json({ ...toClientAccount(account), token: signToken(account) });
};

// Open self sign-up. Answers with the same shape as login (account + token)
// so the new user lands signed in.
const register = async (req, res) => {
  const { password } = req.body;
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  if (!username || !email || !password) {
    res.status(400);
    throw new Error('Username, email and password are required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400);
    throw new Error('Enter a valid email address');
  }

  const problems = validatePasswordStrength(password);
  if (problems.length > 0) {
    res.status(400);
    throw new Error(`Password must have ${problems.join(', ')}`);
  }

  if (await Account.findOne({ username })) {
    res.status(409);
    throw new Error('That username is taken');
  }

  let account;
  try {
    account = await Account.create({
      username,
      email,
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    });
  } catch (err) {
    // Two sign-ups racing for the same username: the unique index wins.
    if (err?.code === 11000) {
      res.status(409);
      throw new Error('That username is taken', { cause: err });
    }
    throw err;
  }

  res.status(201).json({ ...toClientAccount(account), token: signToken(account) });
};

// req.username comes from the verified token (requireAuth), never from a
// param or body the caller controls — this route only ever answers "my own
// account", never anyone else's.
const getAccount = async (req, res) => {
  const account = await Account.findOne({ username: req.username });
  if (!account) {
    res.status(404);
    throw new Error('Account not found');
  }
  res.status(200).json(toClientAccount(account));
};

// Same identity rule as getAccount: acts on the signed-in caller's own
// account (req.username from requireAuth), regardless of what the request
// body contains.
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Current password and new password are required');
  }

  const account = await Account.findOne({ username: req.username });
  const currentMatches = account && (await bcrypt.compare(currentPassword, account.passwordHash));
  if (!currentMatches) {
    res.status(401);
    throw new Error('Current password is incorrect');
  }

  const problems = validatePasswordStrength(newPassword);
  if (problems.length > 0) {
    res.status(400);
    throw new Error(`Password must have ${problems.join(', ')}`);
  }

  account.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await account.save();

  res.status(200).json({ message: 'Your password has been updated.' });
};

const forgotPassword = async (req, res) => {
  const { username } = req.body;
  if (!username) {
    res.status(400);
    throw new Error('Username is required');
  }

  const account = await Account.findOne({ username });

  // Always answer the same way whether or not the account exists, so this
  // endpoint can't be used to discover which usernames are registered.
  if (account) {
    const token = crypto.randomBytes(32).toString('hex');
    account.resetToken = token;
    account.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await account.save();

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password/${token}`;
    await sendPasswordResetEmail({ to: account.email, resetLink });
  }

  res.status(200).json({
    message: 'If that account exists, a reset link has been sent to its email address.',
  });
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const problems = validatePasswordStrength(password);
  if (problems.length > 0) {
    res.status(400);
    throw new Error(`Password must have ${problems.join(', ')}`);
  }

  const account = await Account.findOne({
    resetToken: token,
    resetTokenExpires: { $gt: new Date() },
  });
  if (!account) {
    res.status(400);
    throw new Error('This reset link is invalid or has expired');
  }

  account.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  account.resetToken = null;
  account.resetTokenExpires = null;
  await account.save();

  res.status(200).json({ message: 'Your password has been updated.' });
};

export { login, register, forgotPassword, resetPassword, getAccount, changePassword };
