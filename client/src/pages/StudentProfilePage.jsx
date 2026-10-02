// Screens 1a and 1b are the SAME route — the difference is data, not
// navigation. Fetch the student and their samples; render the samples list
// (1a) when there are any, or the empty state (1b) when there are none.
// Trends and Recommendations are only reachable once analysed data exists,
// so they are disabled in the empty state.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getStudent } from '../lib/api.js';
import Button from '../components/Button.jsx';
import StudentSamplesPanel from '../components/StudentSamplesPanel.jsx';

export default function StudentProfilePage() {
  const { studentId } = useParams();
  const [state, setState] = useState({ status: 'loading' });
  // Reported back by StudentSamplesPanel once it has fetched — this page
  // renders that component rather than fetching samples itself (that's
  // Sample Upload & Ingestion's data, not the profile screen's).
  const [samplesInfo, setSamplesInfo] = useState(null);

  // Reset to the skeleton the moment the student changes (render-phase reset,
  // React's documented pattern) so switching students never flashes stale data.
  const [loadedFor, setLoadedFor] = useState(studentId);
  if (loadedFor !== studentId) {
    setLoadedFor(studentId);
    setState({ status: 'loading' });
    setSamplesInfo(null);
  }

  useEffect(() => {
    let live = true;
    getStudent(studentId)
      .then((student) => {
        if (!live) return;
        setState(student ? { status: 'ready', student } : { status: 'notfound' });
      })
      .catch((err) => live && setState({ status: 'error', message: err.message }));
    return () => {
      live = false;
    };
  }, [studentId]);

  if (state.status === 'loading') return <ProfileSkeleton />;

  if (state.status === 'notfound') {
    return (
      <Feedback
        title="Student not found"
        text="This student may have been removed. Head back to your list."
      />
    );
  }

  if (state.status === 'error') {
    return <Feedback title="Couldn’t load this profile" text={state.message} tone="error" />;
  }

  const { student } = state;
  const hasAnalysedSamples = samplesInfo?.hasAnalysedSamples ?? false;
  const firstName = student.name.split(' ')[0];
  const placement = [
    student.programme,
    student.band && `Band ${student.band}`,
    student.programmeYear && `Y${student.programmeYear}`,
    student.term && `T${student.term}`,
    student.week && `W${student.week}`,
  ]
    .filter(Boolean)
    .join(' / ');

  // The upload flow (screens 2a/2b) lives on its own route.
  const uploadTo = `/students/${studentId}/upload`;

  return (
    <div className="profile">
      {/* Header band: eyebrow → name → grade chip, on ruled exercise-book
          paper (the styling lives on .profile__head in App.css). */}
      <header className="profile__head">
        <div className="profile__id">
          <span className="eyebrow">Student profile</span>
          <h1 className="profile__name">{student.name}</h1>
          <span className="grade">{student.currentGrade}</span>
          {placement && <span className="grade grade--placement">{placement}</span>}
        </div>

        <div className="profile__actions">
          <Button variant="primary" icon="upload" to={uploadTo}>
            Upload writing sample
          </Button>
          <Button
            variant="secondary"
            icon="trends"
            to={hasAnalysedSamples ? `/students/${studentId}/trends` : undefined}
            disabled={!hasAnalysedSamples}
            disabledHint="Available once a sample has been analysed"
          >
            View error trends
          </Button>
          <Button
            variant="secondary"
            icon="recommendations"
            to={hasAnalysedSamples ? `/students/${studentId}/recommendations` : undefined}
            disabled={!hasAnalysedSamples}
            disabledHint="Available once a sample has been analysed"
          >
            View recommendations
          </Button>
        </div>
      </header>

      <StudentSamplesPanel
        studentId={studentId}
        firstName={firstName}
        uploadTo={uploadTo}
        onLoaded={setSamplesInfo}
      />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="profile" aria-hidden="true">
      <header className="profile__head">
        <div className="profile__id">
          <span className="eyebrow">Student profile</span>
          <div className="skel skel--title" />
          <div className="skel skel--pill" />
        </div>
        <div className="profile__actions">
          <div className="skel skel--btn" />
          <div className="skel skel--btn" />
          <div className="skel skel--btn" />
        </div>
      </header>
      <div className="samples__list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skel skel--row" />
        ))}
      </div>
    </div>
  );
}

function Feedback({ title, text, tone }) {
  return (
    <div className={`feedback${tone === 'error' ? ' feedback--error' : ''}`}>
      <h2 className="feedback__title">{title}</h2>
      <p className="feedback__text">{text}</p>
      <Button variant="secondary" icon="chevronLeft" to="/">
        Back to my students
      </Button>
    </div>
  );
}
