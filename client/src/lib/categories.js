// ------------------------------------------------------------------
// The error-category vocabulary, in one place — the same discipline as
// status.js: the UI never branches on a raw category string, it asks
// categoryFor() for a label, a short form and a mark.
//
// The six values mirror ERROR_CATEGORIES in server/models/sample.js.
// Categories are told apart by SHAPE + LABEL, never by colour: six new
// palette colours would wreck DESIGN.md §3, and wireframe turn 6 ruled
// out icon-only cues, so every mark is always paired with its word.
// ------------------------------------------------------------------

const CATEGORIES = {
  phonological: { label: 'Phonological', short: 'Phon', icon: 'catPhonological' },
  orthographic: { label: 'Orthographic', short: 'Orth', icon: 'catOrthographic' },
  morphological: { label: 'Morphological', short: 'Morph', icon: 'catMorphological' },
  capitalisation: { label: 'Capitalisation', short: 'Cap', icon: 'catCapitalisation' },
  punctuation: { label: 'Punctuation', short: 'Punct', icon: 'catPunctuation' },
  unsure: { label: 'Unsure', short: 'Unsure', icon: 'catUnsure' },
};

const FALLBACK = { label: 'Uncategorised', short: '—', icon: 'catUnsure' };

// Grouping and filtering order — all six, because an error the AI left as
// "unsure" still has to appear somewhere on the screen.
export const CATEGORY_ORDER = Object.keys(CATEGORIES);

// The reclassify radio list omits "unsure": an educator picking a category
// by hand is, by definition, not unsure. (Matches wireframe 3b.)
export const RECLASSIFY_ORDER = CATEGORY_ORDER.filter((c) => c !== 'unsure');

export function categoryFor(category) {
  return CATEGORIES[category] ?? FALLBACK;
}

// Mirrors CONFIDENCE_THRESHOLD_DEFAULT in
// server/services/errorClassificationEngine.js. Sample responses now carry
// the server's live value as confidenceThreshold, so this constant is only
// the fallback for callers that don't have a sample handy (e.g. before one
// has loaded) - pass the real value through wherever one exists.
export const CONFIDENCE_THRESHOLD = 0.6;

// Drives the "Uncertain — AI needs your judgement" card state. Nothing is
// stored for it: it is derived from the score every render, which is why
// "Confirm tag" writes confidenceScore: 1 rather than setting a flag.
export function isUncertain(error, threshold = CONFIDENCE_THRESHOLD) {
  return error.confidenceScore < threshold;
}

// "88%" / "48% — below threshold"
export function confidenceLabel(error, threshold = CONFIDENCE_THRESHOLD) {
  const pct = `${Math.round(error.confidenceScore * 100)}%`;
  return isUncertain(error, threshold) ? `${pct} — below threshold` : pct;
}
