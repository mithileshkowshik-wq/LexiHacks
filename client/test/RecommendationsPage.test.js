import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const report = {
  generatedAt: '2026-08-11T00:00:00.000Z',
  isOutdated: false,
  strategies: [
    {
      strategy: 'Practise sound-to-letter mapping',
      rationale: 'Targets the reviewed phonological pattern.',
      targetCategories: ['phonological'],
      evidence: [{ category: 'phonological', count: 1, writtenExamples: ['becos'] }],
      worksheets: [
        {
          worksheetId: 'approved-worksheet',
          title: 'Phonological Awareness Pack',
          pageStart: 12,
          pageEnd: 14,
          available: true,
          rationale: 'Use the focused short-vowel section.',
        },
      ],
    },
  ],
};

mock.module('../src/lib/api.js', {
  namedExports: {
    generateRecommendations: async () => report,
    getLatestRecommendations: async () => report,
    getStudent: async () => ({
      studentId: 's1',
      name: 'Synthetic Learner',
      currentGrade: 'Primary 3',
    }),
    getStudentTrends: async () => ({ totalSamples: 1, totalErrors: 1 }),
    worksheetFileUrl: (worksheetId) => `/mock-api/worksheets/${worksheetId}/file`,
  },
});

const { default: RecommendationsPage } = await import('../src/pages/RecommendationsPage.jsx');

afterEach(cleanup);

test('displays the approved worksheet page range and opens the PDF at its first page', async () => {
  render(
    <MemoryRouter initialEntries={['/students/s1/recommendations']}>
      <Routes>
        <Route path="/students/:studentId/recommendations" element={<RecommendationsPage />} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => screen.getByText('Phonological Awareness Pack'));
  assert.ok(screen.getByText('Suggested pages: 12–14'));
  assert.equal(
    screen.getByRole('link', { name: 'Open worksheet PDF' }).getAttribute('href'),
    '/mock-api/worksheets/approved-worksheet/file#page=12'
  );
});
