// One-off script to create the two canonical demo students, so everyone on
// the team develops against the same data. Run with:
//   node seedStudents.js
// Safe to run more than once — skips a student whose name already exists
// instead of creating a duplicate.

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Student } from './models/student.js';

const DEMO_STUDENTS = [
  { name: 'Wei Jie Lim', currentGrade: 'Primary 4' },
  { name: 'Aisha Rahman', currentGrade: 'Primary 3' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);

  for (const student of DEMO_STUDENTS) {
    const existing = await Student.findOne({ name: student.name });
    if (existing) {
      console.log(`Student "${student.name}" already exists — left as is.`);
    } else {
      await Student.create(student);
      console.log(`Created demo student "${student.name}" (${student.currentGrade}).`);
    }
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Failed to seed demo students:', err);
  process.exitCode = 1;
});
