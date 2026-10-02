import { RECLASSIFY_ORDER } from './categories.js';

export const TREND_CATEGORIES = RECLASSIFY_ORDER;

export const DATE_RANGES = [
  { value: '3m', label: 'Last 3 months', months: 3 },
  { value: '6m', label: 'Last 6 months', months: 6 },
  { value: '12m', label: 'Last 12 months', months: 12 },
  { value: 'all', label: 'All time', months: null },
];

function emptyCounts() {
  return Object.fromEntries(TREND_CATEGORIES.map((category) => [category, 0]));
}

// Adapts the server's per-sample trend entries ({ sampleId, title, date,
// totalErrors, categoryCounts }, already filtered to ANALYSED/REVIEWED
// samples with dismissed errors excluded — see studentController.getTrends)
// into the shape this module and TrendChart work with. totalErrors is kept
// as the server sent it (every non-dismissed error, all six categories,
// including "unsure") so it reconciles exactly with the review screen's own
// count; counts is narrowed to the five chartable categories.
export function prepareTrendSamples(serverTrends) {
  return serverTrends
    .filter((entry) => !Number.isNaN(new Date(entry.date).getTime()))
    .map((entry) => ({
      sampleId: entry.sampleId,
      title: entry.title,
      uploadedAt: entry.date,
      totalErrors: entry.totalErrors,
      counts: Object.fromEntries(
        TREND_CATEGORIES.map((category) => [category, entry.categoryCounts?.[category] ?? 0])
      ),
    }))
    .sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
}

export function getRangeStart(range, now = new Date()) {
  const option = DATE_RANGES.find((item) => item.value === range);
  if (!option || option.months === null) return null;

  const targetMonth = new Date(now.getFullYear(), now.getMonth() - option.months, 1);
  const lastDayOfTargetMonth = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0
  ).getDate();

  return new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(now.getDate(), lastDayOfTargetMonth)
  );
}

export function filterSamplesByRange(samples, range, now = new Date()) {
  const start = getRangeStart(range, now);
  if (!start) return samples;

  return samples.filter((sample) => new Date(sample.uploadedAt) >= start);
}

export function applySampleSelection(samples, excludedIds) {
  return samples.filter((sample) => !excludedIds.has(String(sample.sampleId)));
}

// Bounds are `<input type="date">` strings (YYYY-MM-DD) or '' when unset.
// Inclusive on both ends, so picking the same day for from/to still matches
// a sample uploaded that day.
export function filterSamplesByCustomRange(samples, from, to) {
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T23:59:59.999`) : null;
  return samples.filter((sample) => {
    const uploaded = new Date(sample.uploadedAt);
    if (start && uploaded < start) return false;
    if (end && uploaded > end) return false;
    return true;
  });
}

export function summariseTrends(samples) {
  const categoryTotals = emptyCounts();
  let totalErrors = 0;

  for (const sample of samples) {
    for (const category of TREND_CATEGORIES) {
      categoryTotals[category] += sample.counts[category];
    }
    // Use the server's own per-sample total (all six categories, including
    // "unsure") rather than summing the five chartable categories here —
    // otherwise an unsure-categorised error would silently vanish from this
    // total while still counting on the review screen. See trends theme in
    // the Work Allocation audit: "trends must reconcile exactly".
    totalErrors += sample.totalErrors;
  }

  let mostFrequent = null;
  for (const category of TREND_CATEGORIES) {
    if (
      categoryTotals[category] > 0 &&
      (mostFrequent === null || categoryTotals[category] > categoryTotals[mostFrequent])
    ) {
      mostFrequent = category;
    }
  }

  let comparison = null;
  if (samples.length >= 2) {
    const previousTotal = samples.at(-2).totalErrors;
    const latestTotal = samples.at(-1).totalErrors;
    const state =
      latestTotal < previousTotal
        ? 'improving'
        : latestTotal > previousTotal
          ? 'more-errors'
          : 'steady';

    comparison = { state, previousTotal, latestTotal };
  }

  return {
    sampleCount: samples.length,
    firstDate: samples[0]?.uploadedAt ?? null,
    lastDate: samples.at(-1)?.uploadedAt ?? null,
    categoryTotals,
    totalErrors,
    mostFrequent,
    comparison,
  };
}
