// ErrorCard's four states (wireframe 3a/3b): normal, selected, uncertain and
// removed — plus the two inline panels (reclassify, remove-confirm) that
// live under the card instead of in a modal (DESIGN.md §9).

import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

const { default: ErrorCard } = await import('../src/components/ErrorCard.jsx');

afterEach(cleanup);

function baseError(overrides = {}) {
  return {
    errorIndex: 0,
    n: 1,
    category: 'phonological',
    written: 'beacuse',
    intended: 'because',
    note: "Sounded-out spelling; 'because' misheard as 'beacuse'.",
    confidenceScore: 0.92,
    dismissed: false,
    locationOnScan: { page: 0, x: 0.1, y: 0.1, z: 0.1, w: 0.1 },
    ...overrides,
  };
}

function renderCard(props = {}) {
  const handlers = {
    onSelect: mock.fn(),
    onReclassify: mock.fn(),
    onDismiss: mock.fn(),
    onRestore: mock.fn(),
    onKeep: mock.fn(),
    onUndo: mock.fn(),
  };
  render(
    <ErrorCard
      error={baseError()}
      selected={false}
      multiPage={false}
      busy={false}
      failure={null}
      confidenceThreshold={0.6}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

test('normal state shows the word, its category and no uncertainty flag', () => {
  renderCard();
  assert.ok(screen.getByText('beacuse'));
  assert.ok(screen.getByText('Phonological'));
  assert.equal(screen.queryByText('Needs a closer look'), null);
  assert.ok(screen.getByText('Keep suggestion'));
});

test('selected state marks the card current and shows the selected tag', () => {
  renderCard({ selected: true });
  const article = document.querySelector('article.ecard');
  assert.equal(article.getAttribute('aria-current'), 'true');
  assert.ok(article.classList.contains('ecard--selected'));
});

test('uncertain state flags below-threshold confidence and confirms via onConfirm', () => {
  const handlers = renderCard({ error: baseError({ confidenceScore: 0.35 }) });
  assert.ok(screen.getByText('Needs a closer look'));

  fireEvent.click(screen.getByText('Keep suggestion'));
  assert.equal(handlers.onKeep.mock.calls.length, 1);
});

test('removed state shows the restore action instead of the normal card body', () => {
  const handlers = renderCard({ error: baseError({ dismissed: true }) });
  assert.ok(screen.getByText('Dismissed — not counted'));
  assert.equal(screen.queryByText('Change category'), null);

  fireEvent.click(screen.getByText('Undo dismissal'));
  assert.equal(handlers.onRestore.mock.calls.length, 1);
});

test('reclassify panel lets an educator pick a different category and save', () => {
  const handlers = renderCard();

  fireEvent.click(screen.getByText('Change category'));
  assert.ok(screen.getByText('Change category to:'));

  const panel = within(document.querySelector('.epanel'));
  // Saving without changing the category is disabled — it starts on the
  // error's current category (phonological). A disabled Button renders as a
  // <span aria-disabled>, not a real <button disabled>.
  assert.ok(panel.getByText('Save correction').closest('[aria-disabled]'));

  fireEvent.click(panel.getByText('Orthographic'));
  fireEvent.click(panel.getByText('Save correction'));

  assert.equal(handlers.onReclassify.mock.calls.length, 1);
  assert.equal(handlers.onReclassify.mock.calls[0].arguments[0], 'orthographic');
});

test('dismiss is immediate and reversible', () => {
  const handlers = renderCard();
  fireEvent.click(screen.getByText('Dismiss'));
  assert.equal(handlers.onDismiss.mock.calls.length, 1);
});
test('kept suggestion offers Undo without showing uncertainty', () => {
  const handlers = renderCard({ reviewed: true, error: baseError({ confidenceScore: 0.35 }) });
  assert.equal(screen.queryByText('Needs a closer look'), null);
  assert.ok(screen.getByText('Kept'));
  fireEvent.click(screen.getByText('Undo'));
  assert.equal(handlers.onUndo.mock.calls.length, 1);
});
