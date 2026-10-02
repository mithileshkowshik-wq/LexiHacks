// Fetches and renders one student's writing-sample list (1a) or the empty
// state (1b) — Sample Upload & Ingestion's data, not the profile screen's.
// StudentProfilePage renders this and just reads back, via onLoaded,
// whether there's anything to enable its own trends/recommendations
// buttons for; it never calls getStudentSamples itself.

import { useEffect, useState } from 'react';
import { getStudentSamples } from '../lib/api.js';
import { statusFor } from '../lib/status.js';
import SampleRow from './SampleRow.jsx';
import EmptyState from './EmptyState.jsx';

export default function StudentSamplesPanel({ studentId, firstName, uploadTo, onLoaded }) {
  const [state, setState] = useState({ status: 'loading' });

  // Reset to the skeleton the moment the student changes (render-phase
  // reset, same pattern StudentProfilePage.jsx uses for its own fetch).
  const [trackedId, setTrackedId] = useState(studentId);
  if (trackedId !== studentId) {
    setTrackedId(studentId);
    setState({ status: 'loading' });
  }

  useEffect(() => {
    let live = true;
    getStudentSamples(studentId)
      .then((samples) => {
        if (!live) return;
        setState({ status: 'ready', samples });
        onLoaded?.({
          hasSamples: samples.length > 0,
          hasAnalysedSamples: samples.some((sample) => statusFor(sample.analysisStatus).ready),
        });
      })
      .catch((err) => live && setState({ status: 'error', message: err.message }));
    return () => {
      live = false;
    };
    // onLoaded is a fresh arrow function on every parent render; keying the
    // effect off it would refetch on every keystroke elsewhere on the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  if (state.status === 'loading') {
    return (
      <div className="samples__list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skel skel--row" />
        ))}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <p className="feedback__text" role="alert">
        Couldn’t load writing samples: {state.message}
      </p>
    );
  }

  const { samples } = state;
  if (samples.length === 0) {
    return <EmptyState firstName={firstName} uploadTo={uploadTo} />;
  }

  return (
    <section className="samples" aria-label="Writing samples">
      <div className="samples__head">
        <h2 className="samples__title">Writing samples</h2>
        <span className="samples__meta">
          Newest first · {samples.length} {samples.length === 1 ? 'sample' : 'samples'}
        </span>
      </div>
      <div className="samples__list">
        {samples.map((sample) => (
          <SampleRow key={sample.sampleId} sample={sample} />
        ))}
      </div>
      <p className="samples__hint">Open an analysed sample to review its error report.</p>
    </section>
  );
}
