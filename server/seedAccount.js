// One-off script to create (or update) the demo login account. Run with:
//   node seedAccount.js
// Safe to run more than once — creates the account if it does not exist,
// or updates its profile fields (without touching the password) if it does.

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Account } from './models/account.js';

const DEMO_ACCOUNT = {
  username: 'Sandy@DAS',
  email: 'sandylim271@gmail.com',
  password: 'Pass@123',
  name: 'Sandy Lim',
  phoneNumber: '91234567',
  role: 'Therapist',
  organisation: 'DAS',
};

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);

  const profileFields = {
    email: DEMO_ACCOUNT.email,
    name: DEMO_ACCOUNT.name,
    phoneNumber: DEMO_ACCOUNT.phoneNumber,
    role: DEMO_ACCOUNT.role,
    organisation: DEMO_ACCOUNT.organisation,
  };

  const existing = await Account.findOne({ username: DEMO_ACCOUNT.username });
  if (existing) {
    Object.assign(existing, profileFields);
    await existing.save();
    console.log(`Demo account "${DEMO_ACCOUNT.username}" already existed — refreshed its profile fields.`);
  } else {
    const passwordHash = await bcrypt.hash(DEMO_ACCOUNT.password, 10);
    await Account.create({
      username: DEMO_ACCOUNT.username,
      passwordHash,
      ...profileFields,
    });
    console.log(`Created demo account "${DEMO_ACCOUNT.username}".`);
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Failed to seed the demo account:', err);
  process.exitCode = 1;
});
