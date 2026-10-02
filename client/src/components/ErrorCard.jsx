// One flagged error in the review list (wireframe 3a), including the two
// inline panels from 3b — reclassify and remove-confirm. They open under the
// card rather than in a modal, per DESIGN.md §9 ("forms live on an inline
// card, not a modal").
//
// Card states: normal · selected · uncertain · removed.
//   uncertain = confidenceScore below the threshold; derived, never stored,
//               so "Confirm tag" writes confidenceScore: 1 to clear it.
//   removed   = the educator dismissed it. The error is KEPT, not deleted
//               (server/models/sample.js) so the decision stays visible and
//               reversible — hence "Restore tag".
//
// `written` is printed exactly as the child wrote it and is never corrected,
// spellchecked or paraphrased anywhere here. That is a product invariant
// (AGENTS.md, DESIGN.md §10), not a styling choice.

import { useState } from 'react';
import Button from './Button.jsx';
import CategoryChip from './CategoryChip.jsx';
import {
  RECLASSIFY_ORDER,
  categoryFor,
  confidenceLabel,
  isUncertain,
} from '../lib/categories.js';

export default function ErrorCard({
  error,
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
  onConfirm,
}) {
  const [panel, setPanel] = useState(null); // null | 'reclassify' | 'remove'
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
          <span className="ecard__removed-note">Removed — not counted</span>
        </div>
        <div className="ecard__actions">
          <Button variant="secondary" icon="undo" onClick={onRestore} disabled={busy}>
            Restore tag
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
        'ecard' +
        (selected ? ' ecard--selected' : '') +
        (uncertain ? ' ecard--uncertain' : '')
      }
      aria-current={selected ? 'true' : undefined}
    >
      {uncertain && (
        <p className="ecard__flag">Uncertain — AI needs your judgement</p>
      )}

      {/* The whole card body selects the error, so clicking anywhere near it
          highlights the matching outline on the scan. */}
      {/* Spans, not divs: a <button> may only contain phrasing content, and
          the layout is all CSS anyway. */}
      <button type="button" className="ecard__pick" onClick={onSelect}>
        <span className="ecard__top">
          <span className="ecard__no" aria-hidden="true">
            {error.n}
          </span>
          <span className="ecard__word">{error.written}</span>
          <span className="ecard__said">student wrote — shown exactly as written</span>
        </span>

        <span className="ecard__meta">
          <CategoryChip category={error.category} />
          <span className="ecard__conf">
            <span className="ecard__conf-label">confidence</span>
            <span className="ecard__bar" aria-hidden="true">
              <span
                className="ecard__bar-fill"
                style={{ width: `${Math.round(error.confidenceScore * 100)}%` }}
              />
            </span>
            <span className="ecard__conf-val">{confidenceLabel(error, confidenceThreshold)}</span>
          </span>
        </span>

        {(error.intended || error.note) && (
          <span className="ecard__reading">
            {error.intended && (
              <span className="ecard__intended">
                AI reads this as “{error.intended}”
              </span>
            )}
            {error.note && <span className="ecard__note">{error.note}</span>}
          </span>
        )}

        <span className="ecard__tags">
          {multiPage && error.locationOnScan && (
            <span className="ecard__page">p.{error.locationOnScan.page + 1}</span>
          )}
          {!error.locationOnScan && (
            <span className="ecard__page ecard__page--none">Not located on the scan</span>
          )}
          {selected && (
            <span className="ecard__state">selected — outlined on scan</span>
          )}
        </span>
      </button>

      <div className="ecard__actions">
        {uncertain && (
          <Button variant="primary" icon="check" onClick={onConfirm} disabled={busy}>
            Confirm tag
          </Button>
        )}
        <Button
          variant="secondary"
          icon="swap"
          onClick={() => (panel === 'reclassify' ? setPanel(null) : openReclassify())}
          disabled={busy}
          aria-expanded={panel === 'reclassify'}
        >
          Reclassify
        </Button>
        <Button
          variant="tertiary"
          icon="trash"
          onClick={() => setPanel(panel === 'remove' ? null : 'remove')}
          disabled={busy}
          aria-expanded={panel === 'remove'}
        >
          Remove tag
        </Button>
      </div>

      {failure && <p className="ecard__failure">{failure}</p>}

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

      {panel === 'remove' && (
        <div className="epanel">
          <p className="epanel__ask">Remove this tag?</p>
          <p className="epanel__text">
            “{error.written}” will no longer be counted as a {cat.label.toLowerCase()}{' '}
            error. The scan itself is never changed, and you can restore the tag
            afterwards.
          </p>
          <div className="epanel__actions">
            <Button variant="tertiary" onClick={() => setPanel(null)}>
              Keep tag
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setPanel(null);
                onDismiss();
              }}
              disabled={busy}
            >
              Remove tag
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
