// StudentSamplesPanel owns the fetch for one student's writing-sample list
// (screens 1a/1b) and reports back, via onLoaded, whether the profile page
// should enable its trends/recommendations buttons.

import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let samplesResult;
mock.module('../src/lib/api.js', {
  namedExports: {
    getStudentSamples: async () => {
      if (samplesResult instanceof Error) throw samplesResult;
      return samplesResult;
    },
    // SampleRow renders a thumbnail via this URL builder - it needs a real
    // export here too, or the module mock leaves it undefined and the
    // import in SampleRow.jsx throws.
    sampleImageUrl: (sampleId, index) => `/mock/samples/${sampleId}/images/${index}`,
  },
});

const { default: StudentSamplesPanel } = await import('../src/components/StudentSamplesPanel.jsx');

afterEach(cleanup);

function renderPanel(onLoaded) {
  return render(
    <MemoryRouter>
      <StudentSamplesPanel
        studentId="s1"
        firstName="Wei Jie"
        uploadTo="/students/s1/upload"
        onLoaded={onLoaded}
      />
    </MemoryRouter>
  );
}

test('renders each sample row and reports hasSamples/hasAnalysedSamples once loaded', async () => {
  samplesResult = [
    { sampleId: 'a', title: 'Journal 1', uploadedAt: '2026-08-01', analysisStatus: 'ANALYSED', imageCount: 1 },
    { sampleId: 'b', title: 'Journal 2', uploadedAt: '2026-08-02', analysisStatus: 'UPLOADED', imageCount: 1 },
  ];
  const loaded = mock.fn();
  renderPanel(loaded);

  await waitFor(() => screen.getByText('Journal 1'));
  assert.ok(screen.getByText('Journal 2'));
  assert.equal(loaded.mock.calls.length, 1);
  assert.deepEqual(loaded.mock.calls[0].arguments[0], {
    hasSamples: true,
    hasAnalysedSamples: true,
  });
});

test('reports hasAnalysedSamples: false when every sample is still pending', async () => {
  samplesResult = [
    { sampleId: 'a', title: 'Journal 1', uploadedAt: '2026-08-01', analysisStatus: 'UPLOADED', imageCount: 1 },
  ];
  const loaded = mock.fn();
  renderPanel(loaded);

  await waitFor(() => screen.getByText('Journal 1'));
  assert.deepEqual(loaded.mock.calls[0].arguments[0], {
    hasSamples: true,
    hasAnalysedSamples: false,
  });
});

test('renders the empty state (screen 1b) and reports no samples', async () => {
  samplesResult = [];
  const loaded = mock.fn();
  renderPanel(loaded);

  await waitFor(() => screen.getByText('No writing samples yet'));
  assert.ok(screen.getByText(/Upload Wei Jie.?s first piece of writing/));
  assert.deepEqual(loaded.mock.calls[0].arguments[0], {
    hasSamples: false,
    hasAnalysedSamples: false,
  });
});

test('surfaces a fetch failure as an alert instead of an empty state', async () => {
  samplesResult = new Error('network down');
  renderPanel(mock.fn());

  const alert = await waitFor(() => screen.getByRole('alert'));
  assert.match(alert.textContent, /network down/);
});
