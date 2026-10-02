// models/Sample.js
// -----------------
// The Sample collection - the heart of the data model. One document per
// uploaded piece of student work, holding everything about it: the image,
// what kind of task it was, how far through the flow it is, and the errors
// the AI found (after the educator's review).
//
// The errors live INSIDE the sample document ("embedded") rather than in
// their own collection, because this module always works with one sample
// end to end. If we later need cross-student analytics ("show me every
// phonological error in Band A"), errors could move to their own collection.

import mongoose from 'mongoose';

// The fixed vocabulary of error categories, used everywhere in the app.
// "unsure" is the AI's honest fallback when it cannot confidently pick one.
export const ERROR_CATEGORIES = [
  'phonological',
  'orthographic',
  'morphological',
  'capitalisation',
  'punctuation',
  'unsure',
];
const boxSchema = new mongoose.Schema(
  {
    // Which page this box belongs to - a 0-based index into the sample's
    // `pages` array, matching upload order. Without this, x/y/z/w alone are
    // ambiguous the moment a sample has more than one page.
    page: { type: Number, required: true, min: 0 },
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
    z: { type: Number, required: true, min: 0, max: 1 },
    w: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false }
);

// The shape of one flagged error. This is a sub-schema: it describes the
// objects inside the sample's `errors` array, not a collection of its own.
const errorSchema = new mongoose.Schema(
  {
    // The word exactly as the child wrote it. This is sacred - it is never
    // auto-corrected anywhere in the app.
    written: { type: String, required: true },

    // The AI's best guess at the word the child meant. The educator can
    // correct this guess during review.
    intended: { type: String, default: '' },

    category: {
      type: String,
      enum: ERROR_CATEGORIES, // "enum" = only these values are allowed
      default: 'unsure',
    },

    // How confident the AI is in this category assignment (0-1). Errors
    // below ErrorClassificationEngine's confidence threshold are surfaced to
    // the educator as "uncertain" instead of a silent guess. Defaults to 1
    // (fully confident) so manually-created errors aren't flagged uncertain.
    confidenceScore: { type: Number, min: 0, max: 1, default: 1 },

    locationOnScan: { type: boxSchema, default: null },
    // A short plain-language reason for the category, written by the AI.
    note: { type: String, default: '' },

    // The educator's human-in-the-loop control: true means "the AI flagged
    // this, but a person decided it is not actually an error". We keep
    // dismissed errors instead of deleting them, so the decision is visible
    // and reversible.
    dismissed: { type: Boolean, default: false },
  },
  { _id: false } // sub-documents don't need their own database ids
);

// One uploaded file ("page") of a sample. A single piece of work can span
// several photographed/scanned pages, so the sample holds an array of these.
const pageSchema = new mongoose.Schema(
  {
    imagePath: { type: String, required: true },
    originalFilename: { type: String, default: '' },
  },
  { _id: false }
);

// Public worksheet metadata. The private Azure blob path is deliberately not
// persisted; downloads resolve this stable ID against the approved manifest.
const worksheetSchema = new mongoose.Schema(
  {
    worksheetId: { type: String, required: true },
    title: { type: String, required: true },
    pageStart: { type: Number, min: 1, default: null },
    pageEnd: {
      type: Number,
      min: 1,
      default: null,
      validate: {
        validator(value) {
          if (value == null) return this.pageStart == null;
          return (
            Number.isInteger(this.pageStart) &&
            Number.isInteger(value) &&
            value >= this.pageStart &&
            value - this.pageStart + 1 >= 2 &&
            value - this.pageStart + 1 <= 3
          );
        },
        message: 'Worksheet recommendations must reference an approved 2-3 page range',
      },
    },
    pdfPages: { type: String, default: '' },
    available: { type: Boolean, default: false },
    targetCategories: [{ type: String, enum: ERROR_CATEGORIES }],
    rationale: { type: String, required: true },
  },
  { _id: false }
);

const sampleSchema = new mongoose.Schema(
  {
    // A reference ("foreign key") to the Student who wrote this work.
    // Storing just the id keeps the data in one place; .populate() in the
    // routes swaps the id for the full student document when we need it.
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // The uploaded images, one entry per file/page, in upload order. We
    // store the PATH, not the image bytes - files belong on the filesystem,
    // not in the database. A sample must have at least one page.
    pages: {
      type: [pageSchema],
      validate: {
        validator: (pages) => pages.length > 0,
        message: 'A sample needs at least one uploaded file',
      },
    },

    // LONG_ANSWER and SHORT_ANSWER tasks have one known correct answer; ESSAY
    // does not. This matters because closed tasks can give the AI an
    // answer key as reading context.
    taskType: {
      type: String,
      enum: ['ESSAY', 'LONG_ANSWER', 'SHORT_ANSWER'],
      required: true,
    },

    // For closed tasks only: the exercise's correct text. Passed to Gemini
    // purely to help it read unclear handwriting - never to correct the
    // child's writing toward it.
    answerKey: { type: String, default: '' },

    // How far through the flow this sample is:
    //   UPLOADED  - image saved, AI has not looked at it yet
    //   ANALYSED  - the AI has flagged errors, awaiting human review
    //   REVIEWED  - an educator has checked the errors against the scan
    //   FAILED    - the AI could not produce a report; see analysisError
    status: {
      type: String,
      enum: ['UPLOADED', 'ANALYSED', 'REVIEWED', 'FAILED'],
      default: 'UPLOADED',
    },

    // Human-readable reason analysis failed (e.g. unreadable file, AI
    // timeout). Only meaningful when status is FAILED; empty otherwise.
    // Never a raw stack trace - the educator reads this directly.
    analysisError: { type: String, default: '' },

    // When the AI finished (successfully or not) - null while status is
    // still UPLOADED. Powers the review screen's subline instead of a
    // hardcoded "analysed by AI" string with no real timestamp behind it.
    analysedAt: { type: Date, default: null },

    // The flagged errors (see errorSchema above).
    errors: { type: [errorSchema], default: [] },

    recommendedWorksheets: {
      type: [worksheetSchema],
      default: [],
      validate: {
        validator: (value) => value.length <= 3,
        message: 'A sample can have at most three recommended worksheets',
      },
    },
    recommendationsGeneratedAt: { type: Date, default: null },

    // Anything the AI could not read on the page, in its own words.
    // "none" or empty means everything was legible.
    illegibleNote: { type: String, default: '' },
  },
  {
    // timestamps: true tells Mongoose to maintain createdAt and updatedAt
    // fields on every document automatically.
    timestamps: true,

    // Mongoose warns that "errors" is a name it also uses internally (for
    // validation errors). Our usage - a plain data array we read and write
    // whole - is safe, so we acknowledge the warning and turn it off.
    suppressReservedKeysWarning: true,

    // pages[].imagePath is a filesystem path - it must never leave the
    // server in a JSON response. Strip it here so every route gets this for
    // free instead of everyone remembering to do it by hand.
    toJSON: {
      transform: (_doc, ret) => {
        ret.pages = ret.pages.map(({ imagePath, ...rest }) => rest);
        return ret;
      },
    },
  }
);

export const Sample = mongoose.model('Sample', sampleSchema);
