import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Button from '../components/Button.jsx';
import CategoryChip from '../components/CategoryChip.jsx';
import Icon from '../components/Icon.jsx';
import TrendChart from '../components/TrendChart.jsx';
import { getStudent, getStudentTrends } from '../lib/api.js';
import { categoryFor } from '../lib/categories.js';
import {
  DATE_RANGES,
  applySampleSelection,
  filterSamplesByCustomRange,
  filterSamplesByRange,
  prepareTrendSamples,
  summariseTrends,
} from '../lib/trends.js';

const longDate = new Intl.DateTimeFormat('en-SG', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const EMPTY_SAMPLES = [];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function ErrorTrendsPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [range, setRange] = useState('3m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [excludedIds, setExcludedIds] = useState(() => new Set());
  const [now] = useState(() => new Date());

  useEffect(() => {
    let live = true;
    // Fetches all-time trend data once (real server aggregation, so it
    // already reconciles with the review screen), then filters by the
    // chosen preset client-side — the range dropdown below stays instant
    // without a round-trip per change.
    Promise.all([getStudent(studentId), getStudentTrends(studentId)])
      .then(([student, trendData]) => {
        if (!live) return;
        if (!student) setState({ status: 'notfound' });
        else {
          setState({
            status: 'ready',
            student,
            samples: prepareTrendSamples(trendData.trends),
          });
        }
      })
      .catch((error) => live && setState({ status: 'error', message: error.message }));

    return () => {
      live = false;
    };
  }, [studentId]);

  const allSamples = state.status === 'ready' ? state.samples : EMPTY_SAMPLES;
  const rangedSamples = useMemo(
    () =>
      range === 'custom'
        ? filterSamplesByCustomRange(allSamples, customFrom, customTo)
        : filterSamplesByRange(allSamples, range, now),
    [allSamples, range, now, customFrom, customTo]
  );
  const includedSamples = useMemo(
    () => applySampleSelection(rangedSamples, excludedIds),
    [rangedSamples, excludedIds]
  );
  const summary = useMemo(() => summariseTrends(includedSamples), [includedSamples]);

  if (state.status === 'loading') return <TrendsSkeleton />;
  if (state.status === 'notfound') {
    return (
      <Feedback
        title="Student not found"
        text="This student may have been removed. Head back to your list."
      />
    );
  }
  if (state.status === 'error') {
    return <Feedback title="Couldn’t load error trends" text={state.message} tone="error" />;
  }

  const { student } = state;
  const firstName = student.name.split(' ')[0];

  function changeRange(event) {
    setRange(event.target.value);
    setExcludedIds(new Set());
  }

  function changeCustomFrom(event) {
    setCustomFrom(event.target.value);
    setExcludedIds(new Set());
  }

  function changeCustomTo(event) {
    setCustomTo(event.target.value);
    setExcludedIds(new Set());
  }

  function toggleSample(sampleId) {
    const key = String(sampleId);
    setExcludedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="trends-page">
      <header className="profile__head trends-head">
        <div className="profile__id">
          <Button variant="tertiary" icon="chevronLeft" to={`/students/${studentId}`}>
            Back to profile
          </Button>
          <span className="eyebrow">Error trends</span>
          <h1 className="profile__name">{student.name}</h1>
          <div className="trends-head__meta">
            <span className="grade">{student.currentGrade}</span>
            <span>Errors per category across analysed samples</span>
          </div>
        </div>
        <div className="profile__actions">
          <Button variant="secondary" icon="recommendations" to={`/students/${studentId}/recommendations`}>
            View recommendations
          </Button>
        </div>
      </header>

      <TrendSummary summary={summary} />

      <CategoryProportions summary={summary} />

      <section className="trend-controls" aria-labelledby="trend-controls-title">
        <div className="trend-controls__range">
          <label className="field" htmlFor="trend-range">
            <span id="trend-controls-title" className="field__label">
              Date range
            </span>
            <select id="trend-range" className="field__input" value={range} onChange={changeRange}>
              {DATE_RANGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom range</option>
            </select>
          </label>

          {range === 'custom' && (
            <>
              <label className="field" htmlFor="trend-custom-from">
                <span className="field__label">From</span>
                <input
                  type="date"
                  id="trend-custom-from"
                  className="field__input"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={changeCustomFrom}
                />
              </label>
              <label className="field" htmlFor="trend-custom-to">
                <span className="field__label">To</span>
                <input
                  type="date"
                  id="trend-custom-to"
                  className="field__input"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={changeCustomTo}
                />
              </label>
            </>
          )}
        </div>

        <details className="trend-sample-picker">
          <summary>
            <span>
              Choose samples
              <small>
                {includedSamples.length} of {rangedSamples.length} included
              </small>
            </span>
          </summary>
          <fieldset className="trend-controls__samples">
            <legend className="sr-only">Samples included</legend>
            {rangedSamples.length === 0 ? (
              <p className="trend-controls__none">No analysed samples in this date range.</p>
            ) : (
              <div className="trend-sample-options">
                {rangedSamples.map((sample) => {
                  const key = String(sample.sampleId);
                  const checked = !excludedIds.has(key);
                  return (
                    <label
                      key={sample.sampleId}
                      className={`trend-sample-option${checked ? ' trend-sample-option--checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSample(sample.sampleId)}
                      />
                      <span>
                        {longDate.format(new Date(sample.uploadedAt))}
                        <small>{sample.title}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        </details>
      </section>

      {includedSamples.length >= 2 ? (
        <TrendChart
          samples={rangedSamples}
          excludedIds={excludedIds}
          onOpenSample={(sampleId) => navigate(`/samples/${sampleId}`)}
        />
      ) : (
        <InsufficientTrend
          firstName={firstName}
          studentId={studentId}
          totalEligible={allSamples.length}
          inRange={rangedSamples.length}
          selected={includedSamples.length}
        />
      )}
    </div>
  );
}

function TrendSummary({ summary }) {
  const mostFrequent = summary.mostFrequent ? categoryFor(summary.mostFrequent) : null;
  const comparison = summary.comparison;
  const comparisonCopy = comparison
    ? {
        improving: { label: 'Improving', symbol: '↘' },
        steady: { label: 'Steady', symbol: '→' },
        'more-errors': { label: 'More errors', symbol: '↗' },
      }[comparison.state]
    : null;

  return (
    <section className="trend-summary" aria-label="Trend summary">
      <article className="trend-summary__card">
        <span className="trend-summary__label">Samples included</span>
        <strong className="trend-summary__value">{summary.sampleCount}</strong>
        <span className="trend-summary__detail">
          {summary.firstDate
            ? `${longDate.format(new Date(summary.firstDate))} – ${longDate.format(new Date(summary.lastDate))}`
            : 'No analysed samples selected'}
        </span>
      </article>

      <article className="trend-summary__card">
        <span className="trend-summary__label">Most frequent category</span>
        <strong className="trend-summary__category">
          {summary.mostFrequent ? (
            <>
              <Icon name={mostFrequent.icon} size={20} />
              {mostFrequent.label}
            </>
          ) : (
            'No tagged errors'
          )}
        </strong>
        <span className="trend-summary__detail">
          {summary.mostFrequent
            ? `${summary.categoryTotals[summary.mostFrequent]} of ${summary.totalErrors} tracked errors`
            : '0 tracked errors in the selected samples'}
        </span>
      </article>

      <article
        className={`trend-summary__card${comparison ? ` trend-summary__card--${comparison.state}` : ''}`}
      >
        <span className="trend-summary__label">Vs previous sample</span>
        <strong className="trend-summary__comparison">
          {comparisonCopy ? `${comparisonCopy.symbol} ${comparisonCopy.label}` : 'Not enough data'}
        </strong>
        <span className="trend-summary__detail">
          {comparison
            ? `${comparison.previousTotal} errors → ${comparison.latestTotal} errors overall`
            : 'Select at least two analysed samples'}
        </span>
      </article>
    </section>
  );
}

// Same five chartable categories as TrendChart, plus "unsure" as a final row
// when the selected samples have any — summary.totalErrors (the server's own
// per-sample total) includes unsure while categoryTotals doesn't, so this is
// the one place that has to reconcile the two to make the rows add to 100%.
function CategoryProportions({ summary }) {
  if (summary.totalErrors === 0) return null;

  const categorised = Object.entries(summary.categoryTotals);
  const categorisedTotal = categorised.reduce((sum, [, count]) => sum + count, 0);
  const unsureTotal = summary.totalErrors - categorisedTotal;
  const rows = unsureTotal > 0 ? [...categorised, ['unsure', unsureTotal]] : categorised;

  return (
    <section className="trend-proportions" aria-labelledby="trend-proportions-title">
      <h2 id="trend-proportions-title" className="trend-proportions__title">
        Share of tracked errors by category
      </h2>
      <ul className="trend-proportions__list">
        {rows.map(([category, count]) => {
          const pct = Math.round((count / summary.totalErrors) * 100);
          return (
            <li key={category} className="trend-proportions__row">
              <CategoryChip category={category} />
              <span className="trend-proportions__bar" aria-hidden="true">
                <span className="trend-proportions__fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="trend-proportions__value">
                {pct}% <small>({plural(count, 'error')})</small>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function InsufficientTrend({ firstName, studentId, totalEligible, inRange, selected }) {
  let detail;
  if (totalEligible < 2) {
    detail = `Trends compare at least two analysed samples. ${firstName} has ${totalEligible} so far — upload and analyse another to see how the errors change over time.`;
  } else if (inRange < 2) {
    detail =
      'There are fewer than two analysed samples in this date range. Choose a wider range to see the trend.';
  } else {
    detail = `Select at least two samples to draw a trend. ${selected === 0 ? 'No samples are currently included.' : 'Only one sample is currently included.'}`;
  }

  return (
    <section className="empty trend-empty" aria-labelledby="trend-empty-title">
      <span className="empty__mark" aria-hidden="true">
        <Icon name="trends" size={48} />
      </span>
      <h2 id="trend-empty-title" className="empty__title">
        Not enough samples for a trend yet
      </h2>
      <p className="empty__text">{detail}</p>
      <Button variant="primary" icon="upload" to={`/students/${studentId}/upload`}>
        Upload writing sample
      </Button>
    </section>
  );
}

function TrendsSkeleton() {
  return (
    <div className="trends-page" aria-hidden="true">
      <header className="profile__head">
        <div className="profile__id">
          <span className="eyebrow">Error trends</span>
          <div className="skel skel--title" />
          <div className="skel skel--pill" />
        </div>
      </header>
      <div className="trend-summary">
        {[0, 1, 2].map((item) => (
          <div key={item} className="skel trend-summary__skeleton" />
        ))}
      </div>
      <div className="skel trends-chart__skeleton" />
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
