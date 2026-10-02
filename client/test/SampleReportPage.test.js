// The review screen groups its flagged errors by category (wireframe 3a):
// one heading per category that actually has live errors, in CATEGORY_ORDER
// regardless of the order the AI returned them in, with dismissed errors
// excluded from the groups and tucked behind "Show N removed tag(s)".

import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Deliberately out of CATEGORY_ORDER (punctuation, then phonological twice,
// then capitalisation, then a dismissed orthographic) to prove grouping
// sorts by category rather than by input order.
const sample = {
  sampleId: 'sample-1',
  studentId: 'student-1',
  title: 'Journal Entry',
  analysisStatus: 'ANALYSED',
  uploadedAt: '2026-08-01T00:00:00.000Z',
  analysedAt: '2026-08-02T00:00:00.000Z',
  imageCount: 1,
  illegibleNote: null,
  confidenceThreshold: 0.6,
  errors: [
    {
      errorIndex: 0,
      n: 1,
      category: 'punctuation',
      written: 'dont',
      confidenceScore: 0.9,
      dismissed: false,
      locationOnScan: { page: 0, x: 0.1, y: 0.1, z: 0.1, w: 0.1 },
    },
    {
      errorIndex: 1,
      n: 2,
      category: 'phonological',
      written: 'beacuse',
      confidenceScore: 0.9,
      dismissed: false,
      locationOnScan: { page: 0, x: 0.2, y: 0.2, z: 0.1, w: 0.1 },
    },
    {
      errorIndex: 2,
      n: 3,
      category: 'phonological',
      written: 'sed',
      confidenceScore: 0.9,
      dismissed: false,
      locationOnScan: { page: 0, x: 0.3, y: 0.3, z: 0.1, w: 0.1 },
    },
    {
      errorIndex: 3,
      n: 4,
      category: 'capitalisation',
      written: 'i',
      confidenceScore: 0.9,
      dismissed: false,
      locationOnScan: { page: 0, x: 0.4, y: 0.4, z: 0.1, w: 0.1 },
    },
    {
      errorIndex: 4,
      category: 'orthographic',
      written: 'recieve',
      confidenceScore: 0.9,
      dismissed: true,
      locationOnScan: { page: 0, x: 0.5, y: 0.5, z: 0.1, w: 0.1 },
    },
  ],
  statistics: {
    categoryCounts: { phonological: 2, orthographic: 0, morphological: 0, capitalisation: 1, punctuation: 1, unsure: 0 },
    total: 4,
  },
};

const errorUpdates = [];

mock.module('../src/lib/api.js', {
  namedExports: {
    getSample: async () => sample,
    getStudent: async () => ({ studentId: 'student-1', name: 'Wei Jie Lim', currentGrade: 'Primary 4' }),
    getLatestRecommendations: async () => null,
    sampleImageUrl: (id, page) => `/mock-api/samples/${id}/images/${page}`,
    // Static imports require every named export SampleReportPage.jsx pulls
    // in to actually exist on the mocked module, even ones these grouping
    // tests never trigger a click for.
    generateRecommendations: async () => {
      throw new Error('not exercised by this test');
    },
    markSampleReviewed: async () => {
      throw new Error('not exercised by this test');
    },
    updateSampleError: async (...args) => {
      errorUpdates.push(args);
      return sample;
    },
  },
});

const { default: SampleReportPage } = await import('../src/pages/SampleReportPage.jsx');

afterEach(() => {
  cleanup();
  errorUpdates.length = 0;
});

function renderReport() {
  return render(
    <MemoryRouter initialEntries={['/samples/sample-1']}>
      <Routes>
        <Route path="/samples/:sampleId" element={<SampleReportPage />} />
      </Routes>
    </MemoryRouter>
  );
}

test('groups live errors by category, in CATEGORY_ORDER, skipping categories with none', async () => {
  renderReport();
  await waitFor(() => screen.getByText('Journal Entry'));

  const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  assert.deepEqual(headings, ['Phonological — 2 errors', 'Capitalisation — 1 error', 'Punctuation — 1 error']);
});

test('dismissed errors are excluded from the groups and tucked behind "Show removed tag(s)"', async () => {
  renderReport();
  await waitFor(() => screen.getByText('Journal Entry'));

  assert.equal(screen.queryByText('recieve'), null);
  assert.ok(screen.getByText('Show 1 removed tag'));

  fireEvent.click(screen.getByText('Show 1 removed tag'));
  assert.ok(screen.getByText('recieve'));
  assert.ok(screen.getByText('Hide 1 removed tag'));
});

test('the category filter narrows the visible groups to the chosen category', async () => {
  renderReport();
  await waitFor(() => screen.getByText('Journal Entry'));

  const filterGroup = within(screen.getByRole('group', { name: 'Filter errors by category' }));
  fireEvent.click(filterGroup.getByText('Capitalisation'));

  const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  assert.deepEqual(headings, ['Capitalisation — 1 error']);
  assert.equal(screen.queryByText('beacuse'), null);
});

test('an educator can submit an error the AI missed', async () => {
  renderReport();
  await waitFor(() => screen.getByText('Journal Entry'));

  fireEvent.change(screen.getByLabelText('Written text'), { target: { value: 'becos' } });
  fireEvent.change(screen.getByLabelText('Error category'), {
    target: { value: 'phonological' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add missed error' }));

  await waitFor(() => assert.equal(errorUpdates.length, 1));
  assert.deepEqual(errorUpdates[0], [
    'sample-1',
    'new',
    { written: 'becos', category: 'phonological' },
  ]);
});
