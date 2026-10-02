// models/account.js
// ------------------
// A login account — separate from Student, which never had auth in mind
// (see server/README.md's "no authentication" note). One document per
// person who can sign in. Passwords are never stored in plain text: only
// passwordHash (bcrypt) is persisted.

import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },

    // Profile fields shown on the account page — none of these affect
    // login, which is keyed on username alone.
    name: { type: String, default: '', trim: true },
    phoneNumber: { type: String, default: '', trim: true },
    role: { type: String, default: '', trim: true },
    organisation: { type: String, default: '', trim: true },

    // Set only while a "forgot password" reset is pending; cleared the
    // moment it is used or replaced by a newer request.
    resetToken: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Account = mongoose.model('Account', accountSchema);
