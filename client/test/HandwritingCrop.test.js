import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
const { default: HandwritingCrop } = await import('../src/components/HandwritingCrop.jsx');
afterEach(cleanup);

test('crop preserves source proportions and bounds the padded viewBox at page edges', () => {
  render(<HandwritingCrop imageUrl="/synthetic-page.png" box={{ x: 0, y: 0, z: 0.2, w: 0.1 }} />);
  const image = document.querySelector('img');
  Object.defineProperty(image, 'naturalWidth', { value: 1000 });
  Object.defineProperty(image, 'naturalHeight', { value: 2000 });
  fireEvent.load(image);
  const crop = screen.getByRole('img', {
    name: 'Original handwritten word from the uploaded page',
  });
  assert.equal(crop.getAttribute('viewBox'), '0 0 208.00000000000003 216.00000000000003');
  assert.equal(crop.querySelector('image').getAttribute('width'), '1000');
  assert.equal(crop.querySelector('image').getAttribute('height'), '2000');
});
test('missing location and failed image show a readable fallback', () => {
  const { rerender } = render(<HandwritingCrop imageUrl="/synthetic-page.png" box={null} />);
  assert.ok(screen.getByText('Handwriting crop unavailable'));
  rerender(
    <HandwritingCrop imageUrl="/synthetic-page.png" box={{ x: 0.1, y: 0.1, z: 0.2, w: 0.1 }} />
  );
  fireEvent.error(document.querySelector('img'));
  assert.ok(screen.getByText('Handwriting crop unavailable'));
});
