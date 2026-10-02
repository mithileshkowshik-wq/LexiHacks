import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const uploads = [];
mock.module('../src/lib/api.js', {
  namedExports: {
    getStudent: async () => ({
      studentId: 'student-upload-test',
      name: 'Synthetic Learner',
      currentGrade: 'Primary 3',
    }),
    uploadSample: async (studentId, payload) => {
      uploads.push({ studentId, ...payload });
      return {
        sampleId: 'sample-upload-test',
        analysisStatus: 'UPLOADED',
        imageCount: payload.files.length,
      };
    },
    getSample: async () => ({
      sampleId: 'sample-upload-test',
      analysisStatus: 'ANALYSED',
      statistics: { total: 1 },
      errors: [],
    }),
  },
});
const { default: UploadSamplePage } = await import('../src/pages/UploadSamplePage.jsx');

beforeEach(() => {
  uploads.length = 0;
  mock.method(URL, 'createObjectURL', () => 'blob:synthetic-upload-preview');
  mock.method(URL, 'revokeObjectURL', () => {});
});
afterEach(() => {
  cleanup();
  mock.restoreAll();
});

async function renderUpload() {
  const view = render(
    <MemoryRouter initialEntries={['/students/student-upload-test/upload']}>
      <Routes>
        <Route path="/students/:studentId/upload" element={<UploadSamplePage />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByRole('button', { name: 'Browse files…' });
  return view.container.querySelector('input[type="file"]');
}

// Browsers expose a live FileList. Clearing input.value also clears that list;
// an immutable test array would hide the selection-loss bug.
function liveFilePicker(input) {
  let selected = [];
  const files = {
    get length() {
      return selected.length;
    },
    item(index) {
      return selected[index] ?? null;
    },
    *[Symbol.iterator]() {
      yield* selected;
    },
  };
  Object.defineProperty(input, 'files', { configurable: true, get: () => files });
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => (selected.length ? 'C:\\fakepath\\synthetic.png' : ''),
    set(value) {
      if (value === '') selected = [];
    },
  });
  return {
    choose(picked) {
      selected = picked;
      // Flush the queued render after the change handler clears the picker.
      act(() => fireEvent.change(input));
    },
  };
}

function scan(name = 'synthetic-writing.png') {
  return new window.File(['fictional scan bytes'], name, { type: 'image/png' });
}

test('Browse keeps the chosen scan after clearing the live file picker and sends it to analysis', async () => {
  const input = await renderUpload();
  const picker = liveFilePicker(input);
  const file = scan();
  picker.choose([file]);
  assert.equal(input.files.length, 0, 'the picker is reset so the same file can be selected again');
  assert.ok(screen.getByText(file.name, { exact: true }));
  assert.equal(uploads.length, 0, 'selecting a file alone does not send it to Gemini');
  fireEvent.change(screen.getByLabelText('Sample title'), {
    target: { value: 'Synthetic writing' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Analyse sample' }));
  await waitFor(() => assert.equal(uploads.length, 1));
  assert.equal(uploads[0].studentId, 'student-upload-test');
  assert.equal(uploads[0].files[0], file);
  assert.equal(uploads[0].title, 'Synthetic writing');
  assert.ok(await screen.findByRole('heading', { name: 'Sample uploaded & analysed' }));
});

test('successive Browse selections retain both pages and ignore duplicate scans', async () => {
  const input = await renderUpload();
  const picker = liveFilePicker(input);
  const first = scan('first-page.png');
  const second = scan('second-page.png');
  picker.choose([first]);
  picker.choose([first, second]);
  assert.ok(screen.getByText(first.name, { exact: true }));
  assert.ok(screen.getByText(second.name, { exact: true }));
  assert.equal(screen.getAllByRole('button', { name: /Remove .*\.png/ }).length, 2);
});

test('dropping scans retains them when the drag data becomes unavailable after the event', async () => {
  await renderUpload();
  const file = scan('dropped-page.png');
  let available = [file];
  const files = {
    *[Symbol.iterator]() {
      yield* available;
    },
  };
  act(() => {
    fireEvent.drop(screen.getByText('Drag & drop the scan here').closest('.dropzone'), {
      dataTransfer: { files },
    });
    available = [];
  });
  assert.ok(screen.getByText(file.name, { exact: true }));
});
