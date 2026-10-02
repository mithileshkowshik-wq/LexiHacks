// hooks/useSamplePolling.js
// -------------------------
// polls GET /api/samples/:sampleId every 2s until analysis finishes, or
// gives up. Backs the "analysing" state (2b) on the upload page.
//
// stops once analysisStatus reads as "done" (via statusFor - handles
// ANALYSED and REVIEWED both, not just one hardcoded value), on FAILED, or
// after MAX_ATTEMPTS with no answer - a stuck sample must not spin the UI
// forever.
//
// A single dropped request (network hiccup, server restart mid-poll) is not
// treated as failure - it just counts toward the same attempt ceiling as an
// ordinary "not ready yet" tick, so a transient blip doesn't strand the
// educator on an error screen for a job that's still running server-side.

import { useEffect, useState } from 'react';
import { getSample } from '../lib/api.js';
import { statusFor } from '../lib/status.js';

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 90; // ~3 minutes: live vision analysis can legitimately take over a minute

// status: 'polling' | 'complete' | 'failed' | 'timeout'
// resetKey: bump it (e.g. a counter) to restart the attempt ceiling for the
// SAME sampleId — "Check again" after a timeout needs this, since the id
// itself hasn't changed.
export function useSamplePolling(sampleId, resetKey = 0) {
  const [state, setState] = useState({ status: 'polling', sample: null });

  // reset the moment sampleId or resetKey changes (render-phase reset, same
  // pattern StudentProfilePage.jsx uses) rather than setState inside the
  // effect below, which would cost an extra wasted render.
  const [tracked, setTracked] = useState({ sampleId, resetKey });
  if (tracked.sampleId !== sampleId || tracked.resetKey !== resetKey) {
    setTracked({ sampleId, resetKey });
    setState({ status: 'polling', sample: null });
  }

  useEffect(() => {
    if (!sampleId) return undefined;

    let live = true;
    let timeoutId;
    let attempts = 0; // scoped to this effect run, so a new sampleId starts fresh
    let lastSample = null;

    async function poll() {
      attempts += 1;

      let sample;
      try {
        sample = await getSample(sampleId);
        lastSample = sample;
      } catch {
        // A dropped poll is not a failed upload - fall through to the same
        // ceiling check as a normal "not ready yet" tick and try again.
      }
      if (!live) return;

      if (sample?.analysisStatus === 'FAILED') {
        setState({ status: 'failed', sample });
      } else if (sample && statusFor(sample.analysisStatus).ready) {
        setState({ status: 'complete', sample });
      } else if (attempts >= MAX_ATTEMPTS) {
        setState({ status: 'timeout', sample: lastSample });
      } else {
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();

    // Navigating away only stops this effect from watching - the analysis
    // itself runs server-side and keeps going regardless.
    return () => {
      live = false;
      clearTimeout(timeoutId);
    };
  }, [sampleId, resetKey]);

  return state;
}
