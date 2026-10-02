// The analysis-status "margin note" — a teacher's annotation, not a badge:
// tracked caps in the status ink with a slightly tilted underline (see
// DESIGN.md §6; the old pill/dot badge was explicitly rejected).
//
// Colour comes from the tone in status.js, never from the raw status
// string, so it survives either backend vocabulary.

import { statusFor } from '../lib/status.js';

export default function StatusPill({ analysisStatus }) {
  const { label, tone } = statusFor(analysisStatus);
  return <span className={`status-note status-note--${tone}`}>{label}</span>;
}
