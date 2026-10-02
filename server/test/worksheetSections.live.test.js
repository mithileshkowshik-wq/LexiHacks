import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { ERROR_CATEGORIES } from '../models/sample.js';

const LIVE_SECTIONS_URL = new URL('../data/worksheetSections.live.json', import.meta.url);

async function liveSections() {
  return JSON.parse(await fs.readFile(LIVE_SECTIONS_URL, 'utf8'));
}

test('live worksheet catalogue contains focused approved page subsets', async () => {
  const sections = await liveSections();

  assert.equal(sections.length, 6);
  assert.ok(
    sections.every((section) => {
      const pageCount = section.pageEnd - section.pageStart + 1;
      return (
        section.catalogueMode === 'live' &&
        Number.isInteger(section.pageStart) &&
        pageCount >= 2 &&
        pageCount <= 3 &&
        section.targetCategories.length === 1 &&
        ERROR_CATEGORIES.includes(section.targetCategories[0])
      );
    })
  );
});

test('large live PDFs use reviewed page ranges instead of whole-document placeholders', async () => {
  const sections = await liveSections();
  const rangesFor = (worksheetId) =>
    sections
      .filter((section) => section.worksheetId === worksheetId)
      .map((section) => `${section.pageStart}-${section.pageEnd}`);

  assert.deepEqual(rangesFor('azure-08709925d250e3e9'), ['12-13']);
  assert.deepEqual(rangesFor('azure-3f46a8c9bda746a6'), ['81-83']);
  assert.deepEqual(rangesFor('azure-719a668d4be858ab'), ['196-198']);
  assert.deepEqual(rangesFor('azure-bd5c6790d05285db'), ['24-25']);
  assert.deepEqual(rangesFor('azure-703fc681e448a159'), ['8-9']);
  assert.equal(rangesFor('azure-3613968427e6e9d2').length, 0);
});
