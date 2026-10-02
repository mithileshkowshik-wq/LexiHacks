import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  applySampleSelection,
  filterSamplesByRange,
  getRangeStart,
  prepareTrendSamples,
  summariseTrends,
} from '../src/lib/trends.js';

// Shaped like one entry of the server's GET /api/students/:id/trends
// response (studentController.getTrends) — status filtering and dismissed-
// error exclusion already happened server-side, so prepareTrendSamples no
// longer needs sample.errors/analysisStatus at all.
function trendEntry({ id, date, categoryCounts = {}, totalErrors }) {
  const total = totalErrors ?? Object.values(categoryCounts).reduce((sum, n) => sum + n, 0);
  return {
    sampleId: id,
    title: `Sample ${id}`,
    date,
    totalErrors: total,
    categoryCounts,
  };
}

describe('trend data preparation', () => {
  test('keeps samples in chronological order and retains zero-error samples', () => {
    const result = prepareTrendSamples([
      trendEntry({ id: 'new', date: '2026-07-20T08:00:00.000Z', totalErrors: 0 }),
      trendEntry({ id: 'old', date: '2026-06-20T08:00:00.000Z', totalErrors: 0 }),
    ]);

    assert.deepEqual(
      result.map((item) => item.sampleId),
      ['old', 'new']
    );
    assert.equal(result[1].totalErrors, 0);
  });

  test('narrows to five chartable categories while keeping the server total for reconciliation', () => {
    const [result] = prepareTrendSamples([
      trendEntry({
        id: 'one',
        date: '2026-07-20T08:00:00.000Z',
        categoryCounts: { phonological: 1, punctuation: 1, unsure: 1 },
        totalErrors: 3, // the server's full count, including the "unsure" error
      }),
    ]);

    assert.equal(result.counts.phonological, 1);
    assert.equal(result.counts.punctuation, 1);
    assert.equal('unsure' in result.counts, false);
    // Reconciles with the review screen's own count even though "unsure"
    // isn't one of the five charted series — regression test for the
    // trends/review-screen mismatch found in the Work Allocation audit.
    assert.equal(result.totalErrors, 3);
  });
});

describe('trend filtering and selection', () => {
  test('calculates calendar-month date presets and supports all time', () => {
    const now = new Date(2026, 6, 31, 12);
    const start = getRangeStart('3m', now);

    assert.deepEqual([start.getFullYear(), start.getMonth(), start.getDate()], [2026, 3, 30]);
    assert.equal(getRangeStart('all', now), null);
  });

  test('filters by range and removes explicitly excluded samples', () => {
    const prepared = prepareTrendSamples([
      trendEntry({ id: 'old', date: '2026-01-01T08:00:00.000Z' }),
      trendEntry({ id: 'middle', date: '2026-06-01T08:00:00.000Z' }),
      trendEntry({ id: 'latest', date: '2026-07-20T08:00:00.000Z' }),
    ]);
    const ranged = filterSamplesByRange(prepared, '3m', new Date(2026, 6, 31, 12));
    const selected = applySampleSelection(ranged, new Set(['middle']));

    assert.deepEqual(
      ranged.map((item) => item.sampleId),
      ['middle', 'latest']
    );
    assert.deepEqual(
      selected.map((item) => item.sampleId),
      ['latest']
    );
  });
});

describe('trend summaries', () => {
  test('uses category order to break a most-frequent tie', () => {
    const prepared = prepareTrendSamples([
      trendEntry({
        id: 'one',
        date: '2026-06-01T08:00:00.000Z',
        categoryCounts: { phonological: 1, orthographic: 1 },
      }),
    ]);

    assert.equal(summariseTrends(prepared).mostFrequent, 'phonological');
  });

  test('reports improving, steady, and more-errors comparisons', () => {
    const makePair = (previous, latest) =>
      prepareTrendSamples([
        trendEntry({
          id: 'previous',
          date: '2026-06-01T08:00:00.000Z',
          categoryCounts: { phonological: previous },
        }),
        trendEntry({
          id: 'latest',
          date: '2026-07-01T08:00:00.000Z',
          categoryCounts: { phonological: latest },
        }),
      ]);

    assert.equal(summariseTrends(makePair(5, 3)).comparison.state, 'improving');
    assert.equal(summariseTrends(makePair(3, 3)).comparison.state, 'steady');
    assert.equal(summariseTrends(makePair(2, 4)).comparison.state, 'more-errors');
  });
});
