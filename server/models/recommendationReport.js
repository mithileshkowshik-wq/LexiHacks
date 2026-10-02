// The one latest intervention-strategy report for a student. Generating again
// replaces the old report; there is no lifecycle or report history.

import mongoose from 'mongoose';

import { ERROR_CATEGORIES } from './sample.js';

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

const evidenceSchema = new mongoose.Schema(
  {
    category: { type: String, enum: ERROR_CATEGORIES, required: true },
    count: { type: Number, min: 1, required: true },
    writtenExamples: { type: [String], default: [] },
    sampleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sample' }],
  },
  { _id: false }
);

const strategySchema = new mongoose.Schema(
  {
    strategy: { type: String, required: true, trim: true },
    rationale: { type: String, required: true, trim: true },
    targetCategories: [{ type: String, enum: ERROR_CATEGORIES }],
    evidence: { type: [evidenceSchema], default: [] },
    worksheets: { type: [worksheetSchema], default: [] },
  },
  { _id: false }
);

const recommendationReportSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
      unique: true,
    },
    basedOnSamples: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sample' }],
    strategies: { type: [strategySchema], default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_document, result) => {
        result.reportId = result._id.toString();
        delete result._id;
        delete result.__v;
        return result;
      },
    },
  }
);

recommendationReportSchema.index({ student: 1, generatedAt: -1 });

export const RecommendationReport = mongoose.model(
  'RecommendationReport',
  recommendationReportSchema
);
