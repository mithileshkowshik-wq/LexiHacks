import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import Button from '../components/Button.jsx';
import CategoryChip from '../components/CategoryChip.jsx';
import {
  generateRecommendations,
  getLatestRecommendations,
  getStudent,
  getStudentTrends,
  worksheetFileUrl,
} from '../lib/api.js';

// Show the latest grounded report and open approved worksheets through the API proxy.
export default function RecommendationsPage() {
  const { studentId } = useParams();
  const [state, setState] = useState({ status: 'loading' });

  // Load student metadata, the optional latest report, and (for the two
  // distinct empty states — wireframe 5c) whether this student has any
  // analysed evidence at all, together on route changes. getStudentTrends
  // already aggregates exactly {totalSamples, totalErrors} across
  // ANALYSED/REVIEWED samples in one request.
  useEffect(() => {
    let live = true;
    Promise.all([
      getStudent(studentId),
      getLatestRecommendations(studentId),
      getStudentTrends(studentId),
    ])
      .then(([student, report, trends]) => {
        if (!student) throw new Error('Student not found.');
        if (live) setState({ status: 'ready', student, report, trends });
      })
      .catch((error) => {
        if (live) setState({ status: 'error', message: error.message });
      });
    return () => {
      live = false;
    };
  }, [studentId]);

  // Replace the current report only after a successful server generation.
  const handleGenerate = async () => {
    setState((current) => ({ ...current, status: 'generating', generationError: null }));
    try {
      const report = await generateRecommendations(studentId);
      setState((current) => ({ ...current, status: 'ready', report }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'ready',
        generationError: error.message,
      }));
    }
  };

  if (state.status === 'loading') {
    return <div className="skel skel--row" aria-label="Loading recommendations" />;
  }
  if (state.status === 'error') {
    return (
      <section className="feedback feedback--error">
        <h1 className="feedback__title">Couldn’t load recommendations</h1>
        <p className="feedback__text">{state.message}</p>
        <Button variant="secondary" to={`/students/${studentId}`}>
          Back to student
        </Button>
      </section>
    );
  }

  const { student, report, trends } = state;
  const generating = state.status === 'generating';
  const hasAnalysedSamples = (trends?.totalSamples ?? 0) > 0;

  return (
    <div className="profile recommendations-page">
      <header className="profile__head">
        <div className="profile__id">
          <span className="eyebrow">Intervention recommendations</span>
          <h1 className="profile__name">{student?.name ?? 'Student'}</h1>
          {student?.currentGrade && <span className="grade">{student.currentGrade}</span>}
        </div>
        <div className="profile__actions">
          {generating && (
            <span className="generating-indicator" role="status" aria-live="polite">
              <span className="generating-indicator__spinner" aria-hidden="true" />
              Gemini is reviewing the evidence…
            </span>
          )}
          <Button
            variant="primary"
            icon="recommendations"
            disabled={generating}
            disabledHint="Gemini is reviewing the student’s analysed samples"
            onClick={handleGenerate}
          >
            {generating
              ? report
                ? 'Refreshing…'
                : 'Generating…'
              : report
                ? 'Refresh recommendations'
                : 'Generate recommendations'}
          </Button>
          <Button variant="secondary" to={`/students/${studentId}`}>
            Back to student
          </Button>
        </div>
      </header>

      {state.generationError && (
        <p className="recommendations-error" role="alert">
          Recommendations could not be generated: {state.generationError}
        </p>
      )}

      {report?.isOutdated && (
        <div className="recommendations-warning" role="status">
          <div>
            <strong>These recommendations may be outdated.</strong>
            <p>The reviewed sample evidence changed after this report was generated.</p>
          </div>
          <Button variant="secondary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Refreshing…' : 'Refresh now'}
          </Button>
        </div>
      )}

      {!report ? (
        <section className="recommendations-empty">
          {hasAnalysedSamples ? (
            // 5c(b): samples exist, nothing generated yet — name the real
            // evidence this report would be based on.
            <>
              <h2>Nothing generated yet</h2>
              <p>
                {trends.totalSamples} analysed {trends.totalSamples === 1 ? 'sample' : 'samples'},{' '}
                {trends.totalErrors} tagged {trends.totalErrors === 1 ? 'error' : 'errors'} ready to
                reason over.
              </p>
              <Button
                variant="primary"
                icon="recommendations"
                disabled={generating}
                disabledHint="Gemini is reviewing the student’s analysed samples"
                onClick={handleGenerate}
              >
                {generating ? 'Generating…' : 'Generate recommendations'}
              </Button>
              {generating && (
                <span className="generating-indicator" role="status" aria-live="polite">
                  <span className="generating-indicator__spinner" aria-hidden="true" />
                  Gemini is reviewing the evidence…
                </span>
              )}
            </>
          ) : (
            // 5c(a): nothing to reason over at all yet.
            <>
              <h2>No error report yet</h2>
              <p>
                Recommendations are based on analysed writing samples — upload one to get started.
              </p>
              <Button variant="primary" icon="upload" to={`/students/${studentId}/upload`}>
                Upload writing sample
              </Button>
            </>
          )}
        </section>
      ) : (
        <section className="recommendations" aria-label="Intervention strategies">
          <div className="samples__head">
            <h2 className="samples__title">Suggested next steps</h2>
            <span className="samples__meta">
              Generated {new Date(report.generatedAt).toLocaleDateString()}
            </span>
          </div>
          <div className="recommendations__list">
            {report.strategies.map((strategy, index) => (
              <article className="recommendation-card" key={`${strategy.strategy}-${index}`}>
                <span className="recommendation-card__number">Strategy {index + 1}</span>
                <h3>{strategy.strategy}</h3>
                {strategy.targetCategories?.length > 0 && (
                  <div className="recommendation-card__categories">
                    {strategy.targetCategories.map((category) => (
                      <CategoryChip key={category} category={category} short />
                    ))}
                  </div>
                )}
                <p>{strategy.rationale}</p>
                {strategy.evidence?.length > 0 && (
                  <div className="recommendation-card__evidence">
                    <strong>Reviewed evidence</strong>
                    {strategy.evidence.map((item) => (
                      <span key={item.category}>
                        {item.category}: {item.count} {item.count === 1 ? 'error' : 'errors'}
                        {item.writtenExamples?.length > 0
                          ? ` — ${item.writtenExamples.map((value) => `“${value}”`).join(', ')}`
                          : ''}
                      </span>
                    ))}
                  </div>
                )}
                {strategy.worksheets?.map((worksheet) => (
                  <div className="worksheet-card" key={worksheet.worksheetId}>
                    <div>
                      <span className="eyebrow">Recommended worksheet</span>
                      <h4>{worksheet.title}</h4>
                      <p>{worksheet.rationale}</p>
                      {Number.isInteger(worksheet.pageStart) &&
                      Number.isInteger(worksheet.pageEnd) ? (
                        <small>
                          Suggested pages: {worksheet.pageStart}–{worksheet.pageEnd}
                        </small>
                      ) : (
                        worksheet.pdfPages && (
                          <small>Suggested source pages: {worksheet.pdfPages}</small>
                        )
                      )}
                    </div>
                    {worksheet.available ? (
                      <a
                        className="btn btn--secondary"
                        href={`${worksheetFileUrl(worksheet.worksheetId)}${worksheet.pageStart ? `#page=${worksheet.pageStart}` : ''}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open worksheet PDF
                      </a>
                    ) : (
                      <span className="worksheet-card__unavailable">
                        PDF unavailable in local mock mode
                      </span>
                    )}
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
