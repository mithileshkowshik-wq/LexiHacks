// services/errorClassificationEngine.js
// -------------------------------------
// The AI core. Takes an uploaded Sample and produces the categorised
// errors that get written back onto it.
//
// There is no separate SampleReport model in this codebase (see
// models/sample.js) - errors live embedded on the Sample itself, so the
// "report" this engine produces is just { errors, illegibleNote }, the two
// fields Sample already has room for.
//
// Two ways to run:
//   - Mock mode (default when GEMINI_API_KEY is unset): returns a fixed,
//     realistic fixture. Lets the rest of the team build against a stable
//     shape without burning API quota or waiting on model latency.
//   - Real mode: calls Gemini vision with a structured-output schema so the
//     response maps directly onto DetectedError fields.
//
// Coordinate system for locationOnScan: { page, x, y, z, w }. page is a
// 0-based index into the sample's `pages` array, matching upload order;
// x,y,z,w are normalised 0-1 against that one page's image, where x,y is the
// box's top-left corner and z,w are its width and height. Chosen here in the
// absence of a written agreement with Person 4 (the review screen owner) -
// confirm this still matches what they render before wiring the real screen
// up.
//
// A sample can have multiple pages (a multi-page scan or PDF). All pages are
// sent to Gemini in a single request, in order, so the model can read errors
// that span a page break - the model reports which page each error is on.

import fs from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { ERROR_CATEGORIES, Sample } from "../models/sample.js";
import { buildPrompt } from "./errorClassificationPrompt.js";
import { preprocessImageForAnalysis } from "./imagePreprocessor.js";

// Confidence threshold that drives the "uncertain - AI needs your judgement"
// state. 0.6 is picked so a roughly coin-flip guess (0.5) always gets a human
// look, while confident calls (0.8+) pass straight through. Tune via
// ERROR_CONFIDENCE_THRESHOLD once real model output can be checked against
// teacher corrections.
export const CONFIDENCE_THRESHOLD_DEFAULT = 0.6;

export function getConfidenceThreshold() {
  const fromEnv = Number(process.env.ERROR_CONFIDENCE_THRESHOLD);
  return Number.isFinite(fromEnv) && fromEnv >= 0 && fromEnv <= 1
    ? fromEnv
    : CONFIDENCE_THRESHOLD_DEFAULT;
}

export function isUncertain(detectedError, threshold = getConfidenceThreshold()) {
  return detectedError.confidenceScore < threshold;
}

// group(error) - assigns/confirms a single detected error's category tag.
// A well-formed error keeps the category already on it; anything that
// isn't a recognised category (missing, misspelled, or not one of
// ERROR_CATEGORIES) is tagged "unsure" rather than rejected, since this is
// meant to be a lenient last step, not a validation gate - validateAnalysisResult
// is what enforces the strict schema earlier in the pipeline.
export function group(error) {
  if (error && typeof error === "object" && ERROR_CATEGORIES.includes(error.category)) {
    return error.category;
  }
  return "unsure";
}

// Exported so callers can tell a timed-out analysis apart from other
// failures (see describeFailure below).
export class TimeoutError extends Error {}

function readConfig() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  return {
    apiKey,
    useMock: process.env.USE_MOCK_AI
      ? process.env.USE_MOCK_AI === "true"
      : apiKey === "",
    // "-latest" alias rather than a pinned version: pinned Gemini models get
    // retired for new API keys (gemini-2.5-flash already 404s), and this
    // project needs to keep working past any one model's lifetime.
    modelName: process.env.GEMINI_MODEL_NAME || "gemini-flash-latest",
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 90000,
    maxRetries: Number(process.env.GEMINI_MAX_RETRIES) || 2,
    retryBaseMs: Number(process.env.GEMINI_RETRY_BASE_MS) || 500,
  };
}

// ---------------------------------------------------------------------------
// Mock mode
// ---------------------------------------------------------------------------

// One example per category, plus one deliberately low-confidence entry so
// the "uncertain" UI state has something real to render against. `page` is
// filled in per-sample below (structuredClone'd fixtures don't know how many
// pages a given sample has), spread across whatever pages exist so
// multi-page samples get realistic, non-trivial coverage in tests.
const MOCK_REPORT = {
  illegibleNote: "",
  errors: [
    {
      written: "beacuse",
      intended: "because",
      category: "phonological",
      confidenceScore: 0.92,
      note: "Sounded-out spelling; 'because' misheard as 'beacuse'.",
      locationOnScan: { x: 0.12, y: 0.18, z: 0.14, w: 0.05 },
    },
    {
      written: "recieve",
      intended: "receive",
      category: "orthographic",
      confidenceScore: 0.88,
      note: "'i before e' spelling rule reversed.",
      locationOnScan: { x: 0.35, y: 0.18, z: 0.13, w: 0.05 },
    },
    {
      written: "goed",
      intended: "went",
      category: "morphological",
      confidenceScore: 0.81,
      note: "Regular past-tense '-ed' applied to an irregular verb.",
      locationOnScan: { x: 0.55, y: 0.3, z: 0.1, w: 0.05 },
    },
    {
      written: "i",
      intended: "I",
      category: "capitalisation",
      confidenceScore: 0.95,
      note: "First-person pronoun not capitalised.",
      locationOnScan: { x: 0.1, y: 0.42, z: 0.03, w: 0.05 },
    },
    {
      written: "dont",
      intended: "don't",
      category: "punctuation",
      confidenceScore: 0.9,
      note: "Missing apostrophe in the contraction.",
      locationOnScan: { x: 0.2, y: 0.42, z: 0.09, w: 0.05 },
    },
    {
      written: "fone",
      intended: "phone",
      category: "unsure",
      confidenceScore: 0.35,
      note: "Could be a phonological respelling of 'phone' or a proper noun - low confidence.",
      locationOnScan: { x: 0.4, y: 0.55, z: 0.1, w: 0.05 },
    },
  ],
};

// Mock-mode convention so the FAILED path can be exercised without a real
// broken file or an API key: a sample whose imagePath or original filename
// (on any page) contains "corrupt" (case-insensitive) simulates an unreadable
// upload. Documented in server/README.md.
function runMockAnalysis(sample) {
  const pages = sample.pages || [];
  const corruptPage = pages.find(
    (page) => /corrupt/i.test(page.imagePath || "") || /corrupt/i.test(page.originalFilename || "")
  );
  if (corruptPage) {
    throw new Error(`Could not read the uploaded image at "${corruptPage.imagePath}"`);
  }

  const fixture = structuredClone(MOCK_REPORT);
  const pageCount = Math.max(pages.length, 1);
  fixture.errors.forEach((detectedError, index) => {
    detectedError.locationOnScan.page = index % pageCount;
  });
  return fixture;
}

// ---------------------------------------------------------------------------
// Real Gemini vision integration
// ---------------------------------------------------------------------------

function mimeTypeFor(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".pdf") return "application/pdf";
  throw new Error(`Unsupported image type "${ext}" for analysis`);
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    illegibleNote: { type: "string" },
    errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          written: { type: "string" },
          intended: { type: "string" },
          category: { type: "string", enum: ERROR_CATEGORIES },
          confidenceScore: { type: "number", minimum: 0, maximum: 1 },
          note: { type: "string" },
          locationOnScan: {
            type: "object",
            properties: {
              page: { type: "integer", minimum: 0 },
              x: { type: "number", minimum: 0, maximum: 1 },
              y: { type: "number", minimum: 0, maximum: 1 },
              z: { type: "number", minimum: 0, maximum: 1 },
              w: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["page", "x", "y", "z", "w"],
          },
        },
        required: ["written", "intended", "category", "confidenceScore", "locationOnScan"],
      },
    },
  },
  required: ["illegibleNote", "errors"],
};

function responseSchemaForPageCount(pageCount) {
  const schema = structuredClone(RESPONSE_SCHEMA);
  schema.properties.errors.items.properties.locationOnScan.properties.page.maximum = Math.max(pageCount - 1, 0);
  return schema;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`Gemini request timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Is this error Gemini telling us "slow down"? The free tier allows only a
// small number of requests per minute, so this is an expected condition
// during real testing, not a bug - and it needs a longer wait than a
// generic transient failure, since a short backoff often will not clear a
// per-minute quota window.
function isRateLimitError(err) {
  const text = `${err?.status ?? ""} ${err?.message ?? ""}`;
  return text.includes("429") || text.includes("RESOURCE_EXHAUSTED");
}

// pageCount is optional: when the caller knows how many pages the sample
// actually has (real analysis), an out-of-range page index is rejected too.
// Unit tests that build a result by hand can omit it and just get the
// looser "is this a valid non-negative integer" check.
export function validateAnalysisResult(result, pageCount) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Analysis result must be an object");
  }
  if (typeof result.illegibleNote !== "string") {
    throw new Error("illegibleNote must be a string");
  }
  if (!Array.isArray(result.errors)) {
    throw new Error("errors must be an array");
  }
  result.errors.forEach((detectedError, index) => {
    if (!detectedError || typeof detectedError.written !== "string" || detectedError.written.trim() === "") {
      throw new Error(`errors[${index}].written must be a non-empty string`);
    }
    if (typeof detectedError.intended !== "string") {
      throw new Error(`errors[${index}].intended must be a string`);
    }
    if (!ERROR_CATEGORIES.includes(detectedError.category)) {
      throw new Error(
        `errors[${index}].category "${detectedError.category}" is not one of ${ERROR_CATEGORIES.join(", ")}`
      );
    }
    if (
      typeof detectedError.confidenceScore !== "number" ||
      detectedError.confidenceScore < 0 ||
      detectedError.confidenceScore > 1
    ) {
      throw new Error(`errors[${index}].confidenceScore must be a number between 0 and 1`);
    }
    const box = detectedError.locationOnScan;
    const hasValidCoords =
      box && ["x", "y", "z", "w"].every((key) => typeof box[key] === "number" && box[key] >= 0 && box[key] <= 1);
    if (!hasValidCoords) {
      throw new Error(`errors[${index}].locationOnScan must have x, y, z, w numbers between 0 and 1`);
    }
    const hasValidPage =
      box &&
      Number.isInteger(box.page) &&
      box.page >= 0 &&
      (pageCount === undefined || box.page < pageCount);
    if (!hasValidPage) {
      throw new Error(
        `errors[${index}].locationOnScan.page must be a valid page index` +
          (pageCount === undefined ? "" : ` (0-${pageCount - 1})`)
      );
    }
  });
  return result;
}

// NOTE: written against @google/genai, Google's current unified Gemini SDK.
// This is the piece most likely to drift as the SDK evolves - if
// `ai.models.generateContent` or the response shape has changed by the time
// this is wired up for real, check the current Gemini API docs and adjust
// this function; nothing else in this file depends on the SDK shape.
async function callModelWithRetry(ai, parts, config, pageCount) {
  let lastError;
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      const result = await withTimeout(
        ai.models.generateContent({
          model: config.modelName,
          contents: [{ role: "user", parts }],
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchemaForPageCount(pageCount),
          },
        }),
        config.timeoutMs
      );
      const parsed = JSON.parse(result.text);
      return validateAnalysisResult(parsed, pageCount);
    } catch (err) {
      lastError = err;
      if (attempt < config.maxRetries) {
        // Rate-limit backs off harder (4x the configured base) since retrying
        // quickly after a 429 just trips the limit again.
        const baseDelayMs = isRateLimitError(err) ? config.retryBaseMs * 4 : config.retryBaseMs;
        await sleep(baseDelayMs * 2 ** attempt);
      }
    }
  }
  throw lastError;
}

async function runRealAnalysis(sample, config) {
  if (!config.apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const pages = sample.pages || [];

  // Every page goes into the same request, in upload order, so the model
  // can read an error that spans a page break and so its reported `page`
  // index lines up with this order.
  const imageParts = [];
  for (const page of pages) {
    let imageBytes;
    try {
      imageBytes = await fs.readFile(page.imagePath);
    } catch {
      throw new Error(`Could not read the uploaded image at "${page.imagePath}"`);
    }
    const processedImage = await preprocessImageForAnalysis(imageBytes);
    imageParts.push({
      inlineData: { mimeType: "image/png", data: processedImage.toString("base64") },
    });
  }

  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const parts = [{ text: buildPrompt(sample) }, ...imageParts];

  return callModelWithRetry(ai, parts, config, pages.length);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ErrorClassificationEngine.analyse(sample) - runs mock or real analysis and
// returns the fields Sample needs updated: { errors, illegibleNote }.
export async function analyseSample(sample) {
  const config = readConfig();
  const result = config.useMock ? runMockAnalysis(sample) : await runRealAnalysis(sample, config);

  return {
    illegibleNote: result.illegibleNote,
    errors: result.errors.map((detectedError) => ({
      written: detectedError.written,
      intended: detectedError.intended,
      category: detectedError.category,
      confidenceScore: detectedError.confidenceScore,
      note: detectedError.note || "",
      locationOnScan: detectedError.locationOnScan,
      dismissed: false,
    })),
  };
}

export function describeFailure(err) {
  if (err instanceof TimeoutError) {
    return "Analysis timed out. The image may be too large, or the AI service is slow to respond.";
  }
  if (err instanceof Error && err.message.startsWith("Could not read the uploaded image")) {
    return err.message;
  }
  if (err instanceof Error && err.message === "GEMINI_API_KEY is not configured") {
    return "Analysis is not configured (missing GEMINI_API_KEY).";
  }
  // Just the reason - the caller (UI, log line) supplies the "analysis
  // failed" framing, so repeating it here reads twice on screen.
  return "The AI could not produce a usable error report for this sample.";
}

// The background job. Call this after the 202 response for a sample upload
// has already been sent (do not await it in the request handler). Always
// resolves the sample to ANALYSED or FAILED - it never leaves a sample
// stuck mid-analysis, even if Gemini errors out after every retry.
export async function runAnalysis(sampleId) {
  // Outer guard: this runs fire-and-forget, so nothing is waiting to catch a
  // rejection. Reading the sample or saving it can still fail (unreachable
  // database, malformed id) and an unhandled rejection would take the whole
  // server down - so the job logs and gives up quietly instead of throwing.
  try {
    const sample = await Sample.findById(sampleId);
    if (!sample) {
      console.error(`runAnalysis: no sample found for id ${sampleId}`);
      return;
    }

    // Inner guard: an analysis that fails is a normal outcome, not a crash.
    // It decides which status gets written, and the save below records it.
    try {
      const { errors, illegibleNote } = await analyseSample(sample);
      sample.errors = errors;
      sample.illegibleNote = illegibleNote;
      sample.analysisError = "";
      sample.status = "ANALYSED";
      sample.analysedAt = new Date();
    } catch (err) {
      sample.status = "FAILED";
      sample.analysisError = describeFailure(err);
      sample.analysedAt = new Date();
    }

    await sample.save();
  } catch (err) {
    console.error(`runAnalysis: could not persist analysis for ${sampleId}:`, err);
  }
}

// Not public API. Exposed only so the unit tests can drive the retry,
// timeout and prompt-construction logic with a stub client, instead of
// against a live API call. Do not import these from application code.
export const __testing = { callModelWithRetry, buildPrompt, mimeTypeFor };

const ErrorClassificationEngine = { analyse: analyseSample, group };
export default ErrorClassificationEngine;
