// models/Student.js
// ------------------
// A Mongoose schema describes what fields a document has and what type each
// one is. Mongoose then validates every save against this description.

import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true, // remove accidental spaces around the ID
  },
  currentGrade: {
    type: String,
    required: true,
    trim: true, // remove accidental spaces around the ID
  },
  programme: {
    type: String,
    enum: ['SLP', 'ELL-MLP', null],
    default: null,
    trim: true,
  },
  band: {
    type: String,
    enum: ['A', 'B', 'C', null],
    default: null,
    trim: true,
    uppercase: true,
  },
  programmeYear: {
    type: Number,
    min: 1,
    max: 6,
    default: null,
  },
  term: {
    type: Number,
    min: 1,
    max: 4,
    default: null,
  },
  week: {
    type: Number,
    min: 1,
    max: 20,
    default: null,
  },
  // Optional while there is no auth (see paths.txt) - once login exists it
  // comes from the session instead of the request body.
  teacherId: {
    type: String,
    default: '',
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// mongoose.model registers the schema under the name "Student". Mongoose
// stores these documents in a MongoDB collection called "students".
export const Student = mongoose.model('Student', studentSchema);
