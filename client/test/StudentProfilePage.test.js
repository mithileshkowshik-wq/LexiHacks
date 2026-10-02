// Screens 1a/1b are one route: StudentProfilePage fetches the student and
// delegates the samples list to StudentSamplesPanel, then gates the
// trends/recommendations buttons on whether onLoaded reported any analysed
// sample.

import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let studentResult;
let samplesResult;
mock.module('../src/lib/api.js', {
  namedExports: {
    getStudent: async () => studentResult,
    getStudentSamples: async () => samplesResult,
    // StudentSamplesPanel renders SampleRow, which builds a thumbnail URL
    // from this export - needs a real value or the import throws.
    sampleImageUrl: (sampleId, index) => `/mock-api/samples/${sampleId}/images/${index}`,
  },
});

const { default: StudentProfilePage } = await import('../src/pages/StudentProfilePage.jsx');

afterEach(cleanup);

function renderProfile(studentId = 's1') {
  return render(
    <MemoryRouter initialEntries={[`/students/${studentId}`]}>
      <Routes>
        <Route path="/students/:studentId" element={<StudentProfilePage />} />
      </Routes>
    </MemoryRouter>
  );
}

test('renders the student header, placement, and enables trends/recommendations once a sample is analysed', async () => {
  studentResult = {
    studentId: 's1',
    name: 'Wei Jie Lim',
    currentGrade: 'Primary 4',
    programme: 'SLP',
    band: 'B',
    programmeYear: 1,
    term: 1,
    week: 4,
  };
  samplesResult = [
    {
      sampleId: 'a',
      title: 'Journal 1',
      uploadedAt: '2026-08-01',
      analysisStatus: 'ANALYSED',
      imageCount: 1,
    },
  ];
  renderProfile();

  // Wait for the samples panel's own fetch to resolve too — it reports
  // hasAnalysedSamples back to this page asynchronously, independently of
  // the student fetch, so "Wei Jie Lim" alone isn't enough to synchronize on.
  await waitFor(() => screen.getByText('Journal 1'));
  assert.ok(screen.getByText('Primary 4'));
  assert.ok(screen.getByText('SLP / Band B / Y1 / T1 / W4'));

  const trendsLink = screen.getByText('View error trends').closest('a');
  assert.equal(trendsLink.getAttribute('href'), '/students/s1/trends');
  const recsLink = screen.getByText('View recommendations').closest('a');
  assert.equal(recsLink.getAttribute('href'), '/students/s1/recommendations');
});

test('disables trends/recommendations until a sample has been analysed', async () => {
  studentResult = { studentId: 's1', name: 'Wei Jie Lim', currentGrade: 'Primary 4' };
  samplesResult = [
    {
      sampleId: 'a',
      title: 'Journal 1',
      uploadedAt: '2026-08-01',
      analysisStatus: 'UPLOADED',
      imageCount: 1,
    },
  ];
  renderProfile();

  await waitFor(() => screen.getByText('Journal 1'));

  // A disabled Button renders as a <span aria-disabled>, not a real link.
  // closest() matches the element itself first, and the text sits in an
  // inner <span> too, so target the aria-disabled attribute specifically
  // rather than the tag name.
  const trends = screen.getByText('View error trends').closest('[aria-disabled]');
  assert.equal(trends.getAttribute('aria-disabled'), 'true');
});

test('shows "Student not found" when the student does not exist', async () => {
  studentResult = null;
  samplesResult = [];
  renderProfile('missing');

  await waitFor(() => screen.getByText('Student not found'));
});
