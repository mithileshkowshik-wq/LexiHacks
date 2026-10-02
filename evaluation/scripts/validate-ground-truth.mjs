#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url);
const VETTED_DIR = new URL('../ground-truth-vetted/', import.meta.url);
const CATEGORIES = new Set([
  'phonological',
  'orthographic',
  'morphological',
  'capitalisation',
  'punctuation',
  'unsure',
]);
const TASK_TYPES = new Set(['ESSAY', 'SHORT_ANSWER', 'LONG_ANSWER', 'UNKNOWN']);

async function jsonFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => path.join(dir.pathname, entry.name));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function assertString(value, label, errors) {
  if (typeof value !== 'string' || value.length === 0) errors.push(`${label} must be a non-empty string`);
}

function validateLocation(location, label, errors) {
  if (location === undefined) return;
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    errors.push(`${label}.locationOnScan must be an object when present`);
    return;
  }
  if (!Number.isInteger(location.page) || location.page < 0) errors.push(`${label}.locationOnScan.page must be an integer >= 0`);
  for (const field of ['x', 'y', 'z', 'w']) {
    if (typeof location[field] !== 'number' || location[field] < 0 || location[field] > 1) {
      errors.push(`${label}.locationOnScan.${field} must be a number between 0 and 1`);
    }
  }
}

function validateGroundTruth(doc, file) {
  const errors = [];
  assertString(doc.sampleId, 'sampleId', errors);
  assertString(doc.sourceFile, 'sourceFile', errors);
  assertString(doc.grade, 'grade', errors);
  if (!TASK_TYPES.has(doc.taskType)) errors.push(`taskType must be one of ${[...TASK_TYPES].join(', ')}`);
  if (doc.reviewStatus !== 'vetted') errors.push('reviewStatus must be "vetted" for files in ground-truth-vetted');
  if (!Array.isArray(doc.errors)) errors.push('errors must be an array');

  const ids = new Set();
  for (const [index, error] of (doc.errors ?? []).entries()) {
    const label = `errors[${index}]`;
    assertString(error.id, `${label}.id`, errors);
    if (ids.has(error.id)) errors.push(`${label}.id duplicates ${error.id}`);
    ids.add(error.id);
    if (typeof error.written !== 'string') errors.push(`${label}.written must be a string`);
    if (error.intended !== undefined && typeof error.intended !== 'string') errors.push(`${label}.intended must be a string when present`);
    if (!CATEGORIES.has(error.category)) errors.push(`${label}.category must be one of ${[...CATEGORIES].join(', ')}`);
    validateLocation(error.locationOnScan, label, errors);
  }

  return errors.map((message) => `${path.relative(ROOT.pathname, file)}: ${message}`);
}

const files = await jsonFiles(VETTED_DIR);
const failures = [];
let labelledErrors = 0;
for (const file of files) {
  const doc = JSON.parse(await readFile(file, 'utf8'));
  failures.push(...validateGroundTruth(doc, file));
  labelledErrors += doc.errors?.length ?? 0;
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${files.length} vetted ground-truth file(s), ${labelledErrors} labelled error(s).`);
}
