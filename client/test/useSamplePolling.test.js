// Locks in the polling DoD bullets that had code-reading confidence but no
// test: stops on COMPLETE, stops on FAILED with a readable message, and
// stops at the attempt ceiling instead of spinning forever. Uses node:test's
// fake timers so the ~3-minute ceiling doesn't cost real wall-clock time.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { act, cleanup, renderHook } from '@testing-library/react';

let getSampleImpl;
mock.module('../src/lib/api.js', {
  namedExports: {
    getSample: (...args) => getSampleImpl(...args),
  },
});

const { useSamplePolling } = await import('../src/hooks/useSamplePolling.js');

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 90;

beforeEach(() => {
  mock.timers.enable({ apis: ['setTimeout'] });
});

afterEach(() => {
  cleanup();
  mock.timers.reset();
});

// Lets the getSample() microtask chain from the poll that just ran settle,
// without advancing any timer - covers the first attempt, which useEffect
// fires synchronously on mount rather than through setTimeout.
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// Fires every pending 2s tick and lets the resulting getSample() microtask
// chain settle before the next tick is due.
async function advance(times) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      mock.timers.tick(POLL_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });
  }
}

test('stops on COMPLETE once analysisStatus reads as done', async () => {
  getSampleImpl = async () => ({ sampleId: 's1', analysisStatus: 'ANALYSED' });
  const { result } = renderHook(() => useSamplePolling('s1'));

  await settle();
  assert.equal(result.current.status, 'complete');
  assert.equal(result.current.sample.analysisStatus, 'ANALYSED');
});

test('stops on FAILED and carries the failure reason', async () => {
  getSampleImpl = async () => ({
    sampleId: 's1',
    analysisStatus: 'FAILED',
    analysisError: 'The scan was too blurry to read.',
  });
  const { result } = renderHook(() => useSamplePolling('s1'));

  await settle();
  assert.equal(result.current.status, 'failed');
  assert.equal(result.current.sample.analysisError, 'The scan was too blurry to read.');
});

test('stops at the attempt ceiling instead of polling forever', async () => {
  let calls = 0;
  getSampleImpl = async () => {
    calls += 1;
    return { sampleId: 's1', analysisStatus: 'UPLOADED' };
  };
  const { result } = renderHook(() => useSamplePolling('s1'));

  // Live analysis may take over a minute. The UI must keep watching beyond
  // the old 30-attempt ceiling, then stop after its full three-minute budget.
  await settle();
  await advance(29);
  assert.equal(result.current.status, 'polling');
  assert.equal(calls, 30);
  await advance(MAX_ATTEMPTS - 30);

  assert.equal(result.current.status, 'timeout');
  assert.equal(calls, MAX_ATTEMPTS);

  // Nothing left scheduled - ticking further must not resume polling.
  await advance(3);
  assert.equal(calls, MAX_ATTEMPTS);
});

test('unmounting (closing the modal mid-analysis) stops watching without cancelling anything server-side', async () => {
  let calls = 0;
  getSampleImpl = async () => {
    calls += 1;
    return { sampleId: 's1', analysisStatus: 'UPLOADED' };
  };
  const { unmount } = renderHook(() => useSamplePolling('s1'));
  await settle();
  assert.equal(calls, 1);

  unmount();
  // The hook's own cleanup clears its timer; the server-side job it was
  // watching is untouched (nothing here to assert on that side - the point
  // is only that the client stops polling, not that it sends any "cancel").
  await advance(5);
  assert.equal(calls, 1, 'no further polls after unmount');
});
