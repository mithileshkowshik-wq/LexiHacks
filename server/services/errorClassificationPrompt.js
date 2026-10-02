// services/errorClassificationPrompt.js
// ---------------------------------------
// The prompt sent to Gemini, kept in its own file so it is easy to find and
// tweak without touching the retry/timeout/validation logic in
// errorClassificationEngine.js.
//
// The category-disambiguation guidance below is drawn from the team's error
// taxonomy (character-sequence / phonological / orthographic-spelling /
// morphological reference table), collapsed onto the five top-level
// categories this codebase actually persists (ERROR_CATEGORIES in
// models/sample.js) plus "unsure". Do not add new top-level categories here -
// the fixed five-plus-unsure vocabulary is a contract every other slice
// (review screen chips, trends aggregation, recommendations) depends on;
// this file only helps Gemini choose among the categories that already exist.

import { ERROR_CATEGORIES } from "../models/sample.js";

export function buildPrompt(sample) {
  const categoryList = ERROR_CATEGORIES.map((category) => `- ${category}`).join("\n");
  const pageCount = (sample.pages || []).length || 1;

  let answerKeyNote = "";
  if (sample.taskType !== "ESSAY" && sample.answerKey) {
    answerKeyNote = `\nThe expected answer for this task is: "${sample.answerKey}". Use it ONLY to help you read unclear handwriting. Never use it to judge whether the student's answer is "correct", and never let it change the "written" field - "written" must always be exactly what the student wrote, spelling and all.\n`;
  }

  const pageNote =
    pageCount > 1
      ? `This sample has ${pageCount} pages, provided as ${pageCount} images in order (the first image is page 0, the second is page 1, and so on). Treat them as one continuous piece of writing - an error can start on one page and finish on the next.`
      : `This sample has a single page, provided as one image (page 0).`;

  return `You are analysing a scanned, possibly multi-page piece of a child's handwritten schoolwork for a literacy-support tool. Many students using this tool have dyslexia or a related learning difference: expect letter reversals (b/d, p/q), phonetic spellings (words spelled the way they sound), and letter-sequencing errors (letters duplicated, dropped, inserted, or swapped) - but only record what is actually on the page. A correctly spelled word is never a mistake just because the writer has dyslexia.
${pageNote}
Read the handwriting exactly as the child wrote it and flag every spelling, grammar and punctuation error you find. Do not silently correct anything - "written" must always be the child's original text.

For each error, classify it into exactly one of these categories:
${categoryList}
Use "unsure" only when you genuinely cannot decide between the other categories.

Use this guidance to tell the categories apart:
- phonological: the spelling still sounds right, or partly right, when read aloud, even though it is not the standard written form. Includes phonetic (sounded-out) spelling, a vowel or consonant substitution, a dropped or added phoneme/sound, a simplified consonant cluster, a silent letter left out, or the wrong word in a homophone pair (e.g. "their"/"there").
- orthographic: the letters themselves are wrong, out of order, or visually confused, independent of how the word sounds. Includes one letter substituted, deleted, inserted, duplicated, or reversed (b/d, p/q); two letters transposed; an irregular word spelled as if it followed a regular pattern; a double-letter mistake; or an illegal/unusual letter combination.
- morphological: the base word is recognisable but a meaningful word part is wrong - a missing or wrongly added plural marker, a wrong or missing past-tense ending, a wrong third-person-singular form, or a wrong prefix/suffix.
- capitalisation: a letter that should be capitalised is not, or vice versa.
- punctuation: a punctuation mark is missing, extra, or wrong.
${answerKeyNote}
For each error return:
- written: the word or phrase exactly as the child wrote it.
- intended: your best guess at the word or phrase the child meant.
- category: one of the categories above.
- confidenceScore: a number from 0 to 1 for how confident you are in this category assignment.
- note: one short, plain-language sentence explaining the error, written for a teacher. Where relevant, name the specific pattern (e.g. "letter reversal", "vowel substitution", "missing past-tense ending") rather than just repeating the category name.
- locationOnScan: a bounding box around the error, as { page, x, y, z, w } - page is the 0-based index of the image the error appears on, and x, y, z, w are normalised to that image's size (0 to 1), where x,y is the top-left corner and z,w are the width and height.

Also return illegibleNote: a short note describing any part of the page(s) you could not read, or an empty string if everything was legible.

Return only the JSON described by the response schema - no extra commentary.`;
}
