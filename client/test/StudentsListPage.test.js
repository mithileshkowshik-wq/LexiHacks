// Person 1's caseload entry screen: renders the list from GET /api/students,
// filters it client-side as the therapist types, and posts new students
// through the inline form card.

import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const students = [
  { studentId: 's1', name: 'Wei Jie Lim', currentGrade: 'Primary 4' },
  { studentId: 's2', name: 'Aisha Rahman', currentGrade: 'Primary 3' },
];
const createStudentCalls = [];

mock.module('../src/lib/api.js', {
  namedExports: {
    getStudents: async () => students,
    createStudent: async (payload) => {
      createStudentCalls.push(payload);
      return { studentId: 's3', ...payload };
    },
  },
});

// Imported dynamically, after the mock above is registered, so the page
// picks up the mocked api module instead of issuing a real fetch().
const { default: StudentsListPage } = await import('../src/pages/StudentsListPage.jsx');

afterEach(cleanup);

function renderPage() {
  return render(
    <MemoryRouter>
      <StudentsListPage />
    </MemoryRouter>
  );
}

test('renders the caseload once students load', async () => {
  renderPage();
  await waitFor(() => screen.getByText('Wei Jie Lim'));
  assert.ok(screen.getByText('Aisha Rahman'));
});

test('search filters the grid by name, client-side', async () => {
  renderPage();
  await waitFor(() => screen.getByText('Wei Jie Lim'));

  fireEvent.change(screen.getByLabelText('Search students by name'), {
    target: { value: 'aisha' },
  });

  assert.equal(screen.queryByText('Wei Jie Lim'), null);
  assert.ok(screen.getByText('Aisha Rahman'));
});

test('search with no matches keeps the caseload message distinct from the empty-caseload message', async () => {
  renderPage();
  await waitFor(() => screen.getByText('Wei Jie Lim'));

  fireEvent.change(screen.getByLabelText('Search students by name'), {
    target: { value: 'nobody matches this' },
  });

  assert.ok(screen.getByText(/No students match/));
});

test('a caseload card links to that student’s profile', async () => {
  renderPage();
  await waitFor(() => screen.getByText('Wei Jie Lim'));

  const card = screen.getByText('Wei Jie Lim').closest('a');
  assert.equal(card.getAttribute('href'), '/students/s1');
});

test('Add student form posts trimmed fields and prepends the new student to the grid', async () => {
  renderPage();
  await waitFor(() => screen.getByText('Wei Jie Lim'));

  fireEvent.click(screen.getByRole('button', { name: 'Add student' }));
  const form = within(document.querySelector('.student-form'));

  fireEvent.change(form.getByPlaceholderText('e.g. Wei Jie Lim'), {
    target: { value: '  New Kid  ' },
  });
  fireEvent.change(form.getByPlaceholderText('e.g. Primary 4'), {
    target: { value: '  Primary 2  ' },
  });
  fireEvent.change(form.getByPlaceholderText('e.g. SLP'), {
    target: { value: ' SLP ' },
  });
  fireEvent.change(form.getByPlaceholderText('A, B, or C'), {
    target: { value: ' b ' },
  });
  fireEvent.change(form.getByLabelText('Programme year'), {
    target: { value: '1' },
  });
  fireEvent.change(form.getByLabelText('Term'), {
    target: { value: '1' },
  });
  fireEvent.change(form.getByPlaceholderText('e.g. 4'), {
    target: { value: '4' },
  });
  fireEvent.click(form.getByRole('button', { name: 'Add student' }));

  await waitFor(() => screen.getByText('New Kid'));
  assert.deepEqual(createStudentCalls.at(-1), {
    name: 'New Kid',
    currentGrade: 'Primary 2',
    programme: 'SLP',
    band: 'B',
    programmeYear: 1,
    term: 1,
    week: 4,
  });

  // Prepended, not appended — the new student is the first card in the grid.
  const names = screen
    .getAllByText(/./, { selector: '.student-card__name' })
    .map((n) => n.textContent);
  assert.equal(names[0], 'New Kid');
});
