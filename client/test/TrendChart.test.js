import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TREND_CATEGORIES } from '../src/lib/trends.js';
const { default: TrendChart } = await import('../src/components/TrendChart.jsx');
afterEach(cleanup);
const samples = [4, 3, 1].map((value, index) => ({
  sampleId: `sample-${index}`,
  title: `Writing ${index + 1}`,
  uploadedAt: `2026-09-0${index + 1}`,
  totalErrors: value + 1,
  counts: Object.fromEntries(
    TREND_CATEGORIES.map((category) => [
      category,
      category === 'capitalisation' ? value : category === 'punctuation' ? 1 : 0,
    ])
  ),
}));
function draw(excludedIds = new Set()) {
  const open = mock.fn();
  const result = render(
    <MemoryRouter>
      <TrendChart samples={samples} excludedIds={excludedIds} onOpenSample={open} />
    </MemoryRouter>
  );
  return { ...result, open };
}
test('focuses the most frequent category and switches a single series with labelled controls', () => {
  const { open } = draw();
  assert.ok(screen.getByRole('heading', { name: 'Capitalisation over time' }));
  assert.equal(document.querySelectorAll('.trend-series').length, 1);
  fireEvent.click(screen.getByRole('button', { name: /Punctuation/ }));
  assert.ok(screen.getByRole('heading', { name: 'Punctuation over time' }));
  assert.equal(
    screen.getByRole('button', { name: /Punctuation/ }).getAttribute('aria-pressed'),
    'true'
  );
  assert.equal(document.querySelectorAll('.trend-series').length, 1);
  fireEvent.keyDown(document.querySelector('.trend-point'), { key: 'Enter' });
  assert.equal(open.mock.calls[0].arguments[0], 'sample-0');
});
test('excluded samples retain their chronological position without contributing counts', () => {
  draw(new Set(['sample-1']));
  assert.equal(document.querySelectorAll('.trend-point').length, 2);
  assert.equal(document.querySelectorAll('.trend-chart__excluded').length, 1);
  assert.match(
    document.querySelector('.trend-chart-card__focus').textContent,
    /Latest sample: 1 error · Previous sample: 4/
  );
  assert.ok(screen.getByText('View all category data as a table'));
});
