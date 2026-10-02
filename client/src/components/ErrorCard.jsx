// A review suggestion compares the original crop, AI reading and correction.
// Reclassification stays inline; keep and dismiss decisions are reversible.
// Low confidence invites a closer look until the teacher has reviewed it.
// Dismissed errors stay in the array so they can be restored.
//
// `written` is printed exactly as the child wrote it and is never corrected,
// spellchecked or paraphrased anywhere here. That is a product invariant
// (AGENTS.md, DESIGN.md §10), not a styling choice.

import { useState } from 'react';
import Button from './Button.jsx';
import HandwritingCrop from './HandwritingCrop.jsx';
import CategoryChip from './CategoryChip.jsx';
import { RECLASSIFY_ORDER, categoryFor, isUncertain } from '../lib/categories.js';

export default function ErrorCard({
  error,
  imageUrl,
  selected,
  multiPage,
  busy,
  failure,
  innerRef,
  confidenceThreshold,
  onSelect,
  onReclassify,
  onDismiss,
  onRestore,
  onKeep,
  onUndo,
  reviewed = false,
}) {
  const [panel, setPanel] = useState(null); // null | 'reclassify'
  const [choice, setChoice] = useState(error.category);

  const cat = categoryFor(error.category);
  const uncertain = isUncertain(error, confidenceThreshold);

  function openReclassify() {
    setChoice(error.category);
    setPanel('reclassify');
    onSelect();
  }

  if (error.dismissed) {
    return (
      <article className="ecard ecard--removed" ref={innerRef}>
        <div className="ecard__top">
          <span className="ecard__word">{error.written}</span>
          <span className="ecard__removed-note">Dismissed — not counted</span>
        </div>
        <div className="ecard__actions">
          <Button variant="secondary" icon="undo" onClick={onRestore} disabled={busy}>
            Undo dismissal
          </Button>
        </div>
        {failure && <p className="ecard__failure">{failure}</p>}
      </article>
    );
  }

  return (
    <article
      ref={innerRef}
      className={
        'ecard' + (selected ? ' ecard--selected' : '') + (uncertain && !reviewed ? ' ecard--uncertain' : '')
      }
      aria-current={selected ? 'true' : undefined}
    >
      {uncertain && !reviewed && <p className="ecard__flag">Needs a closer look</p>}
      <button type="button" className="ecard__pick" onClick={onSelect}>
        <span className="ecard__heading">
          <span>
            Suggestion {error.n} · <span className="ecard__category-name">{cat.label}</span>
          </span>
          {reviewed && <span className="ecard__kept">Kept</span>}
        </span>
        <span className="ecard__comparison">
          <HandwritingCrop imageUrl={imageUrl} box={error.locationOnScan} />
          <span className="ecard__words">
            <span>
              <span className="ecard__word-label">AI read</span>
              <strong>{error.written}</strong>
            </span>
            {error.intended && (
              <>
                <span className="ecard__arrow" aria-hidden="true">
                  →
                </span>
                <span>
                  <span className="ecard__word-label">Suggested</span>
                  <strong>{error.intended}</strong>
                </span>
              </>
            )}
          </span>
        </span>
        {error.note && <span className="ecard__note">{error.note}</span>}
        {multiPage && error.locationOnScan && (
          <span className="ecard__page">Page {error.locationOnScan.page + 1}</span>
        )}
        {!error.locationOnScan && (
          <span className="ecard__page ecard__page--none">Not located on the scan</span>
        )}
      </button>
      <div className="ecard__actions">
        {reviewed ? (
          <>
            <span className="ecard__decision-note">Included in the report</span>
            <Button variant="tertiary" onClick={onUndo} disabled={busy}>
              Undo
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" icon="check" onClick={onKeep} disabled={busy}>
              Keep suggestion
            </Button>
            <Button variant="tertiary" onClick={onDismiss} disabled={busy}>
              Dismiss
            </Button>
          </>
        )}
        <button
          type="button"
          className="ecard__change"
          disabled={busy}
          onClick={() => (panel === 'reclassify' ? setPanel(null) : openReclassify())}
          aria-expanded={panel === 'reclassify'}
        >
          Change category
        </button>
      </div>
      {failure && (
        <p className="ecard__failure" role="alert">
          {failure}
        </p>
      )}
      {panel === 'reclassify' && (
        <div className="epanel">
          <div className="epanel__head">
            <span className="ecard__word">{error.written}</span>
            <span className="epanel__now">currently {cat.label.toLowerCase()}</span>
          </div>
          <p className="epanel__ask">Change category to:</p>
          <div className="epanel__choices" role="radiogroup" aria-label="New category">
            {RECLASSIFY_ORDER.map((category) => {
              const on = choice === category;
              const current = category === error.category;
              return (
                <button
                  key={category}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`epanel__choice${on ? ' epanel__choice--on' : ''}`}
                  onClick={() => setChoice(category)}
                >
                  <span className="epanel__radio" aria-hidden="true" />
                  <CategoryChip category={category} />
                  {current && <span className="epanel__current">(current)</span>}
                </button>
              );
            })}
          </div>
          <div className="epanel__actions">
            <Button variant="tertiary" onClick={() => setPanel(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setPanel(null);
                onReclassify(choice);
              }}
              disabled={busy || choice === error.category}
              disabledHint={
                choice === error.category ? 'Pick a different category first' : undefined
              }
            >
              Save correction
            </Button>
          </div>
        </div>
      )}

      <details className="ecard__details">
        <summary>AI details</summary>
        <p>
          AI confidence: {Math.round(error.confidenceScore * 100)}%. This is a model estimate, not a
          teacher decision.
        </p>
      </details>
    </article>
  );
}
