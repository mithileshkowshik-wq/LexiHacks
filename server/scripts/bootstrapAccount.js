import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { Account } from '../models/account.js';
import { mongoUriWithDefaultDatabase } from '../config/dbConnection.js';
import { validatePasswordStrength } from '../services/passwordPolicy.js';

export function readBootstrapSettings(env) {
  const username = env.ADMIN_USERNAME?.trim();
  const email = env.ADMIN_EMAIL?.trim();
  const password = env.ADMIN_PASSWORD;
  if (!username || !email || !password || !env.MONGODB_URI) {
    throw new Error('MONGODB_URI, ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.');
  }
  const problems = validatePasswordStrength(password);
  if (problems.length) throw new Error(`ADMIN_PASSWORD needs ${problems.join(', ')}.`);
  return { username, email, password };
}

export async function createCloudAccount(
  settings,
  { accountModel = Account, hashPassword = bcrypt.hash } = {}
) {
  const existing = await accountModel.findOne({ username: settings.username });
  if (existing) return false; // Re-running the job never resets an existing password.
  await accountModel.create({
    username: settings.username,
    email: settings.email,
    passwordHash: await hashPassword(settings.password, 12),
    name: settings.username,
    role: 'Educator',
  });
  return true;
}

async function main() {
  const settings = readBootstrapSettings(process.env);
  try {
    await mongoose.connect(mongoUriWithDefaultDatabase(process.env.MONGODB_URI));
    const created = await createCloudAccount(settings);
    console.log(created ? 'Cloud login account created.' : 'Cloud login account already exists.');
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Database errors can contain connection details. Never print them in cloud job logs.
    console.error(
      'Cloud account setup failed. Check settings, password strength, and database access.'
    );
    process.exitCode = 1;
  });
}
