// ------------------------------------------------------------------
// Absorbs the one real mismatch between the spec and the model.
//
//   server/paths.txt  analysisStatus: PENDING | PROCESSING | COMPLETE | FAILED
//   server/models/sample.js  status:  UPLOADED | ANALYSED | REVIEWED
//
// The UI never branches on raw status strings — it asks statusFor() for a
// label, a tone (drives the pill colour), and whether the row is `ready`
// (i.e. analysis finished, so the row links to its error report).
// Whichever vocabulary your backend settles on, map it here once.
// ------------------------------------------------------------------

const STATUS = {
  // paths.txt vocabulary
  PENDING: { label: 'Pending analysis', tone: 'pending', ready: false },
  PROCESSING: { label: 'Analysing…', tone: 'pending', ready: false },
  COMPLETE: { label: 'Analysed', tone: 'done', ready: true },
  FAILED: { label: 'Analysis failed', tone: 'failed', ready: false },

  // Sample model vocabulary
  UPLOADED: { label: 'Pending analysis', tone: 'pending', ready: false },
  ANALYSED: { label: 'Analysed', tone: 'done', ready: true },
  REVIEWED: { label: 'Reviewed', tone: 'done', ready: true },
};

const FALLBACK = { label: 'Unknown', tone: 'pending', ready: false };

export function statusFor(analysisStatus) {
  return {
    ...(STATUS[analysisStatus] ?? FALLBACK),
    failed: analysisStatus === 'FAILED',
  };
}
