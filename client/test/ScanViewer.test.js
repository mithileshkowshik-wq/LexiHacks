// ScanViewer draws the AI's bounding boxes over the child's scan (wireframe
// 3a), one page at a time, with zoom controls and a full-viewport expand
// overlay. Covers: box rendering/selection, zoom clamping, the expand
// overlay (open, Escape-to-close, Close button) and the broken-page fallback
// for uploads an <img> can't render (PDFs).

import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// ScanViewer only reaches into lib/api.js for sampleImageUrl(); mocking it
// sidesteps api.js's import.meta.env.VITE_API_URL, a Vite-only feature that
// doesn't exist under plain node --test.
mock.module('../src/lib/api.js', {
  namedExports: {
    sampleImageUrl: (sampleId, index) => `/mock-api/samples/${sampleId}/images/${index}`,
  },
});

const { default: ScanViewer } = await import('../src/components/ScanViewer.jsx');

afterEach(cleanup);

const errors = [
  {
    errorIndex: 0,
    n: 1,
    category: 'phonological',
    written: 'beacuse',
    confidenceScore: 0.92,
    locationOnScan: { page: 0, x: 0.1, y: 0.2, z: 0.3, w: 0.1 },
  },
  {
    errorIndex: 1,
    n: 2,
    category: 'orthographic',
    written: 'recieve',
    confidenceScore: 0.88,
    locationOnScan: { page: 1, x: 0.4, y: 0.5, z: 0.2, w: 0.1 },
  },
];

function renderViewer(props = {}) {
  const handlers = { onPageChange: mock.fn(), onSelect: mock.fn() };
  render(
    <ScanViewer
      sampleId="sample-1"
      imageCount={2}
      page={0}
      errors={errors}
      selectedIndex={null}
      illegibleNote={null}
      confidenceThreshold={0.6}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

test('only draws the boxes belonging to the page currently on view', () => {
  renderViewer();
  assert.ok(screen.getByLabelText('Error 1, “beacuse”, Phonological'));
  assert.equal(screen.queryByLabelText('Error 2, “recieve”, Orthographic'), null);
});

test('clicking a box reports its errorIndex back to the parent', () => {
  const handlers = renderViewer();
  fireEvent.click(screen.getByLabelText('Error 1, “beacuse”, Phonological'));
  assert.equal(handlers.onSelect.mock.calls.length, 1);
  assert.equal(handlers.onSelect.mock.calls[0].arguments[0], 0);
});

test('zoom starts at 100% and clamps at the configured min/max', () => {
  renderViewer();
  const readout = () => screen.getByText(/%$/);
  assert.equal(readout().textContent, '100%');

  const zoomOut = screen.getByLabelText('Zoom out');
  // ZOOM_MIN 0.5, ZOOM_STEP 0.25 — three clicks would go to 25%, clamped at 50%.
  fireEvent.click(zoomOut);
  fireEvent.click(zoomOut);
  fireEvent.click(zoomOut);
  assert.equal(readout().textContent, '50%');
  assert.equal(zoomOut.disabled, true);

  fireEvent.click(screen.getByLabelText('Fit to width'));
  assert.equal(readout().textContent, '100%');
});

test('the thumbnail rail only appears for multi-page samples and switches pages', () => {
  renderViewer({ imageCount: 1 });
  assert.equal(screen.queryByLabelText('Pages of this sample'), null);
  cleanup();

  const handlers = renderViewer();
  assert.ok(screen.getByLabelText('Pages of this sample'));
  fireEvent.click(screen.getByTitle('Page 2'));
  assert.equal(handlers.onPageChange.mock.calls.length, 1);
  assert.equal(handlers.onPageChange.mock.calls[0].arguments[0], 1);
});

test('expand opens a full-viewport overlay and Escape closes it', () => {
  renderViewer();
  assert.equal(screen.queryByRole('dialog'), null);

  fireEvent.click(screen.getByLabelText('Expand scan'));
  assert.ok(screen.getByRole('dialog', { name: 'Expanded scanned sample' }));

  fireEvent.keyDown(window, { key: 'Escape' });
  assert.equal(screen.queryByRole('dialog'), null);
});

test('expand overlay also closes via its own Close button', () => {
  renderViewer();
  fireEvent.click(screen.getByLabelText('Expand scan'));
  assert.ok(screen.getByRole('dialog'));

  fireEvent.click(screen.getByText('Close'));
  assert.equal(screen.queryByRole('dialog'), null);
});

test('an image load failure falls back to the "can\'t be shown" panel instead of a broken <img>', () => {
  renderViewer();
  const img = screen.getByAltText('Page 1 of the scanned sample');
  fireEvent.error(img);

  assert.ok(screen.getByText('This page can’t be shown'));
  assert.equal(screen.queryByAltText('Page 1 of the scanned sample'), null);
});

test('an illegible-content note renders when the AI flags unreadable text', () => {
  renderViewer({ illegibleNote: 'margin note, page 2' });
  assert.ok(screen.getByText(/The AI couldn.t read: margin note, page 2/));
});
