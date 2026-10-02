// The left half of the error review screen (wireframe 3a): the child's scan
// with the AI's bounding boxes drawn over it.
//
// MULTI-PAGE. A sample is one piece of work spanning up to 12 uploaded files
// (server/models/sample.js `pages`), and every box carries the 0-based `page`
// it belongs to. So this shows ONE page at a time with a thumbnail rail to
// move between them, and only draws the boxes belonging to the page on view.
// The page itself is owned by the parent, because selecting an error over on
// the right has to be able to bring its page into view.
//
// ZOOM. The page element is sized as a percentage of the viewport
// (`--zoom: 1` === fit to width), and every box is positioned in percentages
// of that element. So the boxes scale with the scan for free — no
// recalculation on zoom, no chance of them drifting off the words.

import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import Button from './Button.jsx';
import { sampleImageUrl } from '../lib/api.js';
import { categoryFor, isUncertain } from '../lib/categories.js';

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

const clamp = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export default function ScanViewer({
  sampleId,
  imageCount,
  page,
  onPageChange,
  errors,
  selectedIndex,
  onSelect,
  illegibleNote,
  confidenceThreshold,
}) {
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  // Which page indices failed to load as an image. PDFs land here (the
  // server streams them straight through and an <img> cannot render one),
  // as does any file that has gone missing on disk.
  const [unrenderable, setUnrenderable] = useState(() => new Set());

  // Escape closes the expanded view, same as the visible close button.
  useEffect(() => {
    if (!expanded) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') setExpanded(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

  const pages = Array.from({ length: imageCount }, (_, i) => i);
  const onThisPage = errors.filter((e) => e.locationOnScan?.page === page);
  const broken = unrenderable.has(page);

  function markBroken(index) {
    setUnrenderable((prev) => new Set(prev).add(index));
  }

  // Shared between the normal split-view viewport and the expanded overlay,
  // so the scan + error outlines never have two independently-maintained
  // copies of this rendering.
  function renderPage() {
    return (
      <div className="scan__page" style={{ '--zoom': zoom }}>
        {broken ? (
          <div className="scan__broken">
            <Icon name="page" size={26} />
            <p className="scan__broken-title">This page can’t be shown</p>
            <p className="scan__broken-text">
              PDF uploads aren’t displayed yet. The AI still read this page, so its
              errors are listed on the right.
            </p>
          </div>
        ) : (
          <img
            className="scan__img"
            src={sampleImageUrl(sampleId, page)}
            alt={`Page ${page + 1} of the scanned sample`}
            onError={() => markBroken(page)}
          />
        )}

        {!broken &&
          onThisPage.map((error) => {
            const { x, y, z, w } = error.locationOnScan;
            const selected = error.errorIndex === selectedIndex;
            const uncertain = isUncertain(error, confidenceThreshold);
            const { label, short } = categoryFor(error.category);
            return (
              <button
                key={error.errorIndex}
                type="button"
                className={
                  'scan-box' +
                  (selected ? ' scan-box--selected' : '') +
                  (uncertain ? ' scan-box--uncertain' : '')
                }
                style={{
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  width: `${z * 100}%`,
                  height: `${w * 100}%`,
                }}
                onClick={() => onSelect(error.errorIndex)}
                aria-pressed={selected}
                aria-label={`Error ${error.n}, “${error.written}”, ${label}`}
              >
                <span className="scan-box__tag">
                  {error.n} · {short}
                  {uncertain && '?'}
                </span>
              </button>
            );
          })}
      </div>
    );
  }

  return (
    <div className="scan">
      <div className="scan__bar">
        <span className="scan__label">scanned sample · zoom</span>
        <div className="scan__zoom">
          <button
            type="button"
            className="scan__ctrl"
            onClick={() => setZoom((z) => clamp(z - ZOOM_STEP))}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Zoom out"
          >
            <Icon name="zoomOut" size={17} />
          </button>
          <span className="scan__readout" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="scan__ctrl"
            onClick={() => setZoom((z) => clamp(z + ZOOM_STEP))}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in"
          >
            <Icon name="zoomIn" size={17} />
          </button>
          <button
            type="button"
            className="scan__ctrl"
            onClick={() => setZoom(1)}
            aria-label="Fit to width"
            title="Fit to width"
          >
            <Icon name="fit" size={17} />
          </button>
          <button
            type="button"
            className="scan__ctrl"
            onClick={() => setExpanded(true)}
            aria-label="Expand scan"
            title="Expand scan"
          >
            <Icon name="expand" size={17} />
          </button>
        </div>
      </div>

      {imageCount > 1 && (
        <div className="scan__rail">
          <div className="scan__thumbs" role="tablist" aria-label="Pages of this sample">
            {pages.map((i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === page}
                className={`scan__thumb${i === page ? ' scan__thumb--on' : ''}`}
                onClick={() => onPageChange(i)}
                title={`Page ${i + 1}`}
              >
                {unrenderable.has(i) ? (
                  <span className="scan__thumb-doc" aria-hidden="true">
                    <Icon name="page" size={16} />
                  </span>
                ) : (
                  <img
                    src={sampleImageUrl(sampleId, i)}
                    alt=""
                    onError={() => markBroken(i)}
                  />
                )}
                <span className="scan__thumb-no">{i + 1}</span>
              </button>
            ))}
          </div>
          <span className="scan__pages">
            Page {page + 1} of {imageCount}
          </span>
        </div>
      )}

      <div className="scan__viewport">{renderPage()}</div>

      <p className="scan__hint">
        Click an outline to select its card on the right, and the other way round.
      </p>

      {expanded && (
        <div
          className="scan__expand-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded scanned sample"
        >
          <div className="scan__expand-bar">
            <div className="scan__zoom">
              <button
                type="button"
                className="scan__ctrl"
                onClick={() => setZoom((z) => clamp(z - ZOOM_STEP))}
                disabled={zoom <= ZOOM_MIN}
                aria-label="Zoom out"
              >
                <Icon name="zoomOut" size={17} />
              </button>
              <span className="scan__readout" aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                className="scan__ctrl"
                onClick={() => setZoom((z) => clamp(z + ZOOM_STEP))}
                disabled={zoom >= ZOOM_MAX}
                aria-label="Zoom in"
              >
                <Icon name="zoomIn" size={17} />
              </button>
              <button
                type="button"
                className="scan__ctrl"
                onClick={() => setZoom(1)}
                aria-label="Fit to width"
                title="Fit to width"
              >
                <Icon name="fit" size={17} />
              </button>
            </div>
            <Button variant="secondary" icon="cross" onClick={() => setExpanded(false)}>
              Close
            </Button>
          </div>
          <div className="scan__expand-viewport">{renderPage()}</div>
        </div>
      )}

      {illegibleNote && (
        <p className="scan__illegible">
          <Icon name="alert" size={15} />
          <span>The AI couldn’t read: {illegibleNote}</span>
        </p>
      )}
    </div>
  );
}
