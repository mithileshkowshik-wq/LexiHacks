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
    onConfirm: mock.fn(),
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
  assert.equal(screen.queryByText('Uncertain — AI needs your judgement'), null);
  assert.equal(screen.queryByText('Confirm tag'), null);
});

test('selected state marks the card current and shows the selected tag', () => {
  renderCard({ selected: true });
  const article = document.querySelector('article.ecard');
  assert.equal(article.getAttribute('aria-current'), 'true');
  assert.ok(screen.getByText('selected — outlined on scan'));
});

test('uncertain state flags below-threshold confidence and confirms via onConfirm', () => {
  const handlers = renderCard({ error: baseError({ confidenceScore: 0.35 }) });
  assert.ok(screen.getByText('Uncertain — AI needs your judgement'));

  fireEvent.click(screen.getByText('Confirm tag'));
  assert.equal(handlers.onConfirm.mock.calls.length, 1);
});

test('removed state shows the restore action instead of the normal card body', () => {
  const handlers = renderCard({ error: baseError({ dismissed: true }) });
  assert.ok(screen.getByText('Removed — not counted'));
  assert.equal(screen.queryByText('Reclassify'), null);

  fireEvent.click(screen.getByText('Restore tag'));
  assert.equal(handlers.onRestore.mock.calls.length, 1);
});

test('reclassify panel lets an educator pick a different category and save', () => {
  const handlers = renderCard();

  fireEvent.click(screen.getByText('Reclassify'));
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

test('remove panel asks for confirmation before dismissing the tag', () => {
  const handlers = renderCard();

  fireEvent.click(screen.getByText('Remove tag'));
  assert.ok(screen.getByText('Remove this tag?'));

  const panel = within(document.querySelector('.epanel'));
  fireEvent.click(panel.getByText('Keep tag'));
  assert.equal(handlers.onDismiss.mock.calls.length, 0);
  assert.equal(document.querySelector('.epanel'), null);

  fireEvent.click(screen.getByText('Remove tag'));
  fireEvent.click(within(document.querySelector('.epanel')).getByText('Remove tag'));
  assert.equal(handlers.onDismiss.mock.calls.length, 1);
});
