// Screen 3 — the error review screen (wireframe turn 3).
//
// 3a is the split view: the child's scan on the left, the AI's flagged
// errors on the right, kept in sync — selecting a card outlines its box and
// brings its page into view, clicking a box scrolls to its card. 3c is the
// same route before analysis has finished; a failed analysis reuses that
// panel in the failed ink.
//
// The screen is multi-page throughout: a sample can span up to 12 uploaded
// files, so `page` lives here (not in ScanViewer) — selecting an error over
// on the right has to be able to move the scan to the page it sits on.
//
// Writes go through PATCH and the server answers with the whole updated
// sample, so counts, cards and filters repaint from that one response
// rather than being patched up locally.

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getSample,
  getStudent,
  getLatestRecommendations,
  generateRecommendations,
  markSampleReviewed,
  updateSampleError,
} from '../lib/api.js';
import { statusFor } from '../lib/status.js';
import { CATEGORY_ORDER, RECLASSIFY_ORDER, categoryFor } from '../lib/categories.js';
import { isOutdatedBannerDismissed, dismissOutdatedBanner } from '../lib/outdatedBanner.js';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';
import StatusPill from '../components/StatusPill.jsx';
import ScanViewer from '../components/ScanViewer.jsx';
import ErrorCard from '../components/ErrorCard.jsx';
import CategoryFilter from '../components/CategoryFilter.jsx';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatUploaded(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function SampleReportPage() {
  const { sampleId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });

  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [missedError, setMissedError] = useState({ written: '', category: '' });
  const [busy, setBusy] = useState(null); // errorIndex currently being written
  const [failure, setFailure] = useState(null); // { errorIndex, message }
  const [corrections, setCorrections] = useState(0);
  // undefined = not checked yet, null = no report exists for this student
  const [recommendationReport, setRecommendationReport] = useState(undefined);
  const [dismissedNow, setDismissedNow] = useState(false); // this-visit dismiss, for instant feedback
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateResult, setRegenerateResult] = useState(null); // 'done' | { error } | null
  const cardRefs = useRef(new Map());

  // Same render-phase reset the profile page uses (React's documented
  // pattern), so moving between samples never flashes the previous one's
  // errors over the new scan — and never leaves the viewer parked on page 3
  // of a sample that only has one page.
  const [loadedFor, setLoadedFor] = useState(sampleId);
  if (loadedFor !== sampleId) {
    setLoadedFor(sampleId);
    setState({ status: 'loading' });
    setPage(0);
    setSelected(null);
    setFilter(null);
    setShowRemoved(false);
    setMissedError({ written: '', category: '' });
    setBusy(null);
    setFailure(null);
    setCorrections(0);
    setRecommendationReport(undefined);
    setDismissedNow(false);
    setRegenerating(false);
    setRegenerateResult(null);
    // cardRefs needs no reset — the callback refs drop their entry as each
    // card unmounts.
  }

  useEffect(() => {
    let live = true;

    getSample(sampleId)
      // The student is a nice-to-have for the header — if that lookup fails
      // the report itself is still perfectly usable, so it must not take the
      // screen down with it.
      .then((sample) =>
        getStudent(sample.studentId).then(
          (student) => ({ sample, student }),
          () => ({ sample, student: null })
        )
      )
      .then(({ sample, student }) => {
        if (live) setState({ status: 'ready', sample, student });
      })
      .catch((err) => {
        if (!live) return;
        setState(
          err.status === 404 ? { status: 'notfound' } : { status: 'error', message: err.message }
        );
      });

    return () => {
      live = false;
    };
  }, [sampleId]);

  // The outdated-tags banner only makes sense once a recommendation report
  // actually exists — otherwise there's nothing for it to be stale against.
  const studentId = state.status === 'ready' ? state.sample.studentId : null;
  useEffect(() => {
    if (!studentId) return undefined;
    let live = true;
    getLatestRecommendations(studentId).then((report) => {
      if (live) setRecommendationReport(report);
    });
    return () => {
      live = false;
    };
  }, [studentId]);

  if (state.status === 'loading') return <ReportSkeleton />;
  if (state.status === 'notfound') {
    return (
      <Feedback
        title="Sample not found"
        text="This sample may have been removed. Head back to your list of students."
      />
    );
  }
  if (state.status === 'error') {
    return <Feedback title="Couldn’t load this report" text={state.message} tone="error" />;
  }

  const { sample, student } = state;
  const backTo = sample.studentId ? `/students/${sample.studentId}` : '/';
  const { ready } = statusFor(sample.analysisStatus);

  // ---- 3c: nothing to review yet ---------------------------------------
  if (!ready) {
    const failed = sample.analysisStatus === 'FAILED';
    return (
      <div className="report">
        <ReportHead
          sample={sample}
          student={student}
          backTo={backTo}
          subline={failed ? 'Analysis did not finish' : 'Waiting for analysis'}
        />
        <div className={`analysing${failed ? ' analysing--failed' : ''}`}>
          {failed ? (
            <span className="report__failmark">
              <Icon name="alert" size={26} />
            </span>
          ) : (
            <div className="analysing__spinner" />
          )}
          <h2 className="analysing__title">
            {failed ? 'This sample couldn’t be analysed' : 'This sample hasn’t been analysed yet'}
          </h2>
          <p className="analysing__text">
            {failed
              ? sample.analysisError || 'The AI could not produce an error report for this sample.'
              : 'Analysis is still running — it usually takes a few seconds. The error report will appear here when it’s done.'}
          </p>
          <div className="analysing__actions">
            <Button variant="secondary" icon="chevronLeft" to={backTo}>
              Back to profile
            </Button>
            {!failed && (
              <Button
                variant="primary"
                icon="refresh"
                onClick={() => {
                  getSample(sampleId).then(
                    (fresh) => setState((s) => ({ ...s, sample: fresh })),
                    (err) => setState({ status: 'error', message: err.message })
                  );
                }}
              >
                Check again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- 3a: the review ---------------------------------------------------

  // A server that predates getSample carrying the errors sends no `errors`
  // key at all. Say that plainly — falling through would draw "the AI didn't
  // flag any errors" over a sample that has nine of them.
  if (!Array.isArray(sample.errors)) {
    return (
      <div className="report">
        <ReportHead sample={sample} student={student} backTo={backTo} subline="Analysed" />
        <Feedback
          title="This report can’t be read yet"
          text="The API answered without the sample’s errors. Restart the server so GET /api/samples/:sampleId sends them."
          tone="error"
        />
      </div>
    );
  }

  // Numbering runs over live errors only, so the badges match what the
  // educator can actually see on the scan.
  const liveErrors = sample.errors.filter((e) => !e.dismissed).map((e, i) => ({ ...e, n: i + 1 }));
  const removed = sample.errors.filter((e) => e.dismissed);
  const byIndex = new Map(liveErrors.map((e) => [e.errorIndex, e]));

  // Server-computed, not re-derived here - recalculated fresh on every
  // read/write so it can never drift from the errors array it summarises.
  const counts = sample.statistics.categoryCounts;

  const shown = filter ? liveErrors.filter((e) => e.category === filter) : liveErrors;
  // Grouped by category with a heading + count per group (wireframe 3a) —
  // when a filter chip is active this naturally collapses to one group.
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    errors: shown.filter((e) => e.category === category),
  })).filter((group) => group.errors.length > 0);

  function selectError(errorIndex) {
    setSelected(errorIndex);
    const box = byIndex.get(errorIndex)?.locationOnScan;
    if (box && box.page !== page) setPage(box.page);
    cardRefs.current.get(errorIndex)?.scrollIntoView({ block: 'nearest' });
  }

  async function patchError(errorIndex, patch, { counted = false } = {}) {
    setBusy(errorIndex);
    setFailure(null);
    try {
      const fresh = await updateSampleError(sampleId, errorIndex, patch);
      setState((s) => ({ ...s, sample: fresh }));
      if (counted) setCorrections((c) => c + 1);
      return true;
    } catch (err) {
      setFailure({ errorIndex, message: `Couldn’t save that change — ${err.message}` });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function addMissedError(event) {
    event.preventDefault();
    const saved = await patchError('new', missedError, { counted: true });
    if (saved) setMissedError({ written: '', category: '' });
  }

  // Marking done ends the visit to this sample, so hand the educator back to
  // the profile they came from — the sample now reads REVIEWED in that list.
  // Only on success: a failed write has to stay on screen with its message.
  async function finishReview() {
    setBusy('review');
    setFailure(null);
    try {
      const fresh = await markSampleReviewed(sampleId);
      setState((s) => ({ ...s, sample: fresh }));
      navigate(backTo);
    } catch (err) {
      setFailure({
        errorIndex: 'review',
        message: `Couldn’t mark this review done — ${err.message}`,
      });
    } finally {
      setBusy(null);
    }
  }

  // Regenerates in place from the banner rather than only linking to the
  // recommendations page. A successful regeneration produces a new report
  // (new reportId) that reflects every correction made so far, so the
  // "you corrected N tags" warning has nothing left to warn about - reset
  // corrections instead of leaving the banner to reappear for a report it
  // no longer describes.
  async function handleRegenerate() {
    if (!student) return;
    setRegenerating(true);
    setRegenerateResult(null);
    try {
      const fresh = await generateRecommendations(student.studentId);
      setRecommendationReport(fresh);
      setCorrections(0);
      setRegenerateResult('done');
    } catch (err) {
      setRegenerateResult({ error: err.message });
    } finally {
      setRegenerating(false);
    }
  }

  const reviewed = sample.analysisStatus === 'REVIEWED';
  // analysedAt is null for samples analysed before this field existed -
  // fall back to the generic "analysed by AI" rather than showing nothing.
  const analysedLabel = sample.analysedAt
    ? `analysed ${formatUploaded(sample.analysedAt)}`
    : 'analysed by AI';
  const subline = [
    `Uploaded ${formatUploaded(sample.uploadedAt)}`,
    analysedLabel,
    `${plural(sample.statistics.total, 'error')} tagged`,
    sample.imageCount > 1 ? plural(sample.imageCount, 'page') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="report">
      <ReportHead
        sample={sample}
        student={student}
        backTo={backTo}
        subline={subline}
        action={
          reviewed ? (
            <span className="report__done">
              <span className="done-mark done-mark--sm">
                <Icon name="check" size={18} />
              </span>
              <span>Review complete</span>
            </span>
          ) : (
            <Button
              variant="primary"
              icon="check"
              onClick={finishReview}
              disabled={busy === 'review'}
              disabledHint="Saving…"
            >
              Mark review done
            </Button>
          )
        }
      />

      {failure?.errorIndex === 'review' && <p className="report__failure">{failure.message}</p>}

      {/* Corrections are counted for this visit only — nothing is stored
          about who changed what, by design. The recommendation endpoint
          computes freshness from sample timestamps. Only shown once a
          recommendation report actually exists — otherwise there is
          nothing for it to be stale against — and only once per report:
          dismissing it persists (client/lib/outdatedBanner.js) so it stays
          gone across a reload until a new report is generated. */}
      {corrections > 0 &&
        recommendationReport &&
        !dismissedNow &&
        !isOutdatedBannerDismissed(recommendationReport.reportId) && (
          <div className="report__banner">
            <Icon name="alert" size={19} className="report__banner-mark" />
            <p className="report__banner-text">
              You corrected {plural(corrections, 'tag')} — recommendations may be outdated.
              {regenerateResult === 'done' && ' Regenerated just now.'}
              {regenerateResult?.error && ` Couldn’t regenerate — ${regenerateResult.error}.`}
            </p>
            <Button
              variant="secondary"
              icon="refresh"
              onClick={handleRegenerate}
              disabled={!student || regenerating}
              disabledHint={!student ? 'Student details are still loading' : 'Regenerating…'}
            >
              {regenerating ? 'Regenerating…' : 'Regenerate now'}
            </Button>
            <Button
              variant="tertiary"
              to={student ? `/students/${student.studentId}/recommendations` : undefined}
              disabled={!student}
              disabledHint="Student details are still loading"
            >
              Review
            </Button>
            <button
              type="button"
              className="report__banner-x"
              onClick={() => {
                dismissOutdatedBanner(recommendationReport.reportId);
                setDismissedNow(true);
              }}
              aria-label="Dismiss"
            >
              <Icon name="cross" size={16} />
            </button>
          </div>
        )}

      <div className="report__split">
        <div className="report__scan">
          {/* Keyed by sample so zoom and the "couldn't render this page" set
              start fresh — otherwise a PDF sample would leave the next
              sample's first page showing the placeholder. */}
          <ScanViewer
            key={sampleId}
            sampleId={sampleId}
            imageCount={sample.imageCount}
            page={page}
            onPageChange={setPage}
            errors={liveErrors}
            selectedIndex={selected}
            onSelect={selectError}
            illegibleNote={sample.illegibleNote}
            confidenceThreshold={sample.confidenceThreshold}
          />
        </div>

        <section className="report__list" aria-label="Flagged errors">
          <CategoryFilter counts={counts} active={filter} onToggle={setFilter} />

          <form className="report__add-error" onSubmit={addMissedError}>
            <h2 className="report__add-error-title">Add an error the AI missed</h2>
            <label className="field">
              <span className="field__label">Written text</span>
              <input
                className="field__input"
                value={missedError.written}
                onChange={(event) =>
                  setMissedError((current) => ({ ...current, written: event.target.value }))
                }
                required
              />
            </label>
            <label className="field">
              <span className="field__label">Error category</span>
              <select
                className="field__input"
                value={missedError.category}
                onChange={(event) =>
                  setMissedError((current) => ({ ...current, category: event.target.value }))
                }
                required
              >
                <option value="">Choose a category</option>
                {RECLASSIFY_ORDER.map((category) => (
                  <option key={category} value={category}>
                    {categoryFor(category).label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary" disabled={busy === 'new'}>
              Add missed error
            </Button>
            {failure?.errorIndex === 'new' && (
              <p className="report__add-error-failure">{failure.message}</p>
            )}
          </form>

          <div className="report__cards">
            {shown.length === 0 && (
              <p className="report__none">
                {liveErrors.length === 0
                  ? 'The AI didn’t flag any errors in this sample.'
                  : 'No errors in that category.'}
              </p>
            )}

            {groups.map((group) => (
              <section
                key={group.category}
                className="report__group"
                aria-label={categoryFor(group.category).label}
              >
                <h3 className="report__group-heading">
                  {categoryFor(group.category).label} — {plural(group.errors.length, 'error')}
                </h3>
                {group.errors.map((error) => (
                  <ErrorCard
                    key={error.errorIndex}
                    error={error}
                    multiPage={sample.imageCount > 1}
                    selected={selected === error.errorIndex}
                    busy={busy === error.errorIndex}
                    failure={failure?.errorIndex === error.errorIndex ? failure.message : null}
                    confidenceThreshold={sample.confidenceThreshold}
                    innerRef={(node) => {
                      if (node) cardRefs.current.set(error.errorIndex, node);
                      else cardRefs.current.delete(error.errorIndex);
                    }}
                    onSelect={() => selectError(error.errorIndex)}
                    onReclassify={(category) =>
                      patchError(error.errorIndex, { category }, { counted: true })
                    }
                    onDismiss={() =>
                      patchError(error.errorIndex, { dismissed: true }, { counted: true })
                    }
                    onConfirm={() => patchError(error.errorIndex, { confidenceScore: 1 })}
                  />
                ))}
              </section>
            ))}

            {removed.length > 0 && (
              <div className="report__removed">
                <button
                  type="button"
                  className="report__removed-toggle"
                  onClick={() => setShowRemoved((v) => !v)}
                  aria-expanded={showRemoved}
                >
                  {showRemoved ? 'Hide' : 'Show'} {plural(removed.length, 'removed tag')}
                </button>
                {showRemoved &&
                  removed.map((error) => (
                    <ErrorCard
                      key={error.errorIndex}
                      error={error}
                      busy={busy === error.errorIndex}
                      failure={failure?.errorIndex === error.errorIndex ? failure.message : null}
                      confidenceThreshold={sample.confidenceThreshold}
                      onRestore={() => patchError(error.errorIndex, { dismissed: false })}
                    />
                  ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ReportHead({ sample, student, backTo, subline, action }) {
  return (
    <header className="profile__head report__head">
      <div className="profile__id">
        <Button variant="tertiary" icon="chevronLeft" to={backTo}>
          {student ? student.name : 'Back to profile'}
        </Button>
        <span className="eyebrow">Error report</span>
        <h1 className="report__title">{sample.title}</h1>
        <p className="report__sub">
          <span>{subline}</span>
          <StatusPill analysisStatus={sample.analysisStatus} />
        </p>
      </div>
      {action && <div className="profile__actions">{action}</div>}
    </header>
  );
}

function ReportSkeleton() {
  return (
    <div className="report" aria-hidden="true">
      <header className="profile__head report__head">
        <div className="profile__id">
          <span className="eyebrow">Error report</span>
          <div className="skel skel--title" />
          <div className="skel skel--pill" />
        </div>
        <div className="profile__actions">
          <div className="skel skel--btn" />
        </div>
      </header>
      <div className="report__split">
        <div className="skel skel--scan" />
        <div className="report__cards">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel skel--ecard" />
          ))}
        </div>
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
