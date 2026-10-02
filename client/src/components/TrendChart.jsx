import { useId, useState } from 'react';
import { Link } from 'react-router-dom';

import { categoryFor } from '../lib/categories.js';
import { TREND_CATEGORIES } from '../lib/trends.js';

const SERIES = {
  phonological: { dash: undefined, marker: 'diamond' },
  orthographic: { dash: '10 7', marker: 'circle' },
  morphological: { dash: '2 7', marker: 'triangle' },
  capitalisation: { dash: '15 6 3 6', marker: 'square' },
  punctuation: { dash: '5 5', marker: 'plus' },
};

const shortDate = new Intl.DateTimeFormat('en-SG', {
  day: '2-digit',
  month: 'short',
});

// Focus on one category at a time; the full dataset remains available below.
export default function TrendChart({ samples, excludedIds, onOpenSample }) {
  const [chosenCategory, setChosenCategory] = useState(null);
  const titleId = useId();
  const descriptionId = useId();
  const included = samples.filter((sample) => !excludedIds.has(String(sample.sampleId)));
  const includedIds = new Set(included.map((sample) => String(sample.sampleId)));

  const categoryTotals = Object.fromEntries(
    TREND_CATEGORIES.map((item) => [
      item,
      included.reduce((total, sample) => total + sample.counts[item], 0),
    ])
  );

  const defaultCategory = TREND_CATEGORIES.reduce(
    (best, item) => (categoryTotals[item] > categoryTotals[best] ? item : best),
    TREND_CATEGORIES[0]
  );
  const activeCategory = chosenCategory ?? defaultCategory;
  const activeLabel = categoryFor(activeCategory).label;
  const latest = included.at(-1)?.counts[activeCategory] ?? 0;
  const previous = included.at(-2)?.counts[activeCategory] ?? 0;
  const chartWidth = Math.max(640, 120 + Math.max(samples.length - 1, 1) * 110);
  const chartHeight = 390;
  // A compact plot leaves room for the axis labels without a detached legend.
  const plot = { left: 62, top: 36, right: chartWidth - 40, bottom: 285 };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const maxValue = Math.max(0, ...included.map((sample) => sample.counts[activeCategory]));
  const tickCount = 4;
  const axisMax = Math.max(1, Math.ceil(maxValue / tickCount)) * tickCount;

  const xForIndex = (index) =>
    samples.length === 1
      ? plot.left + plotWidth / 2
      : plot.left + (index / (samples.length - 1)) * plotWidth;
  const yForValue = (value) => plot.bottom - (value / axisMax) * plotHeight;

  const series = [activeCategory].map((item) => {
    const points = samples
      .map((sample, sampleIndex) => ({ sample, sampleIndex }))
      .filter(({ sample }) => includedIds.has(String(sample.sampleId)))
      .map(({ sample, sampleIndex }) => ({
        sample,
        x: xForIndex(sampleIndex),
        y: yForValue(sample.counts[item]),
        count: sample.counts[item],
      }));
    return { item, config: SERIES[item], category: categoryFor(item), points };
  });

  return (
    <section className="trend-chart-card" aria-labelledby={titleId}>
      <div className="trend-chart-card__head">
        <div>
          <span className="eyebrow">One category at a time</span>
          <h2 id={titleId} className="trend-chart-card__title">
            {activeLabel} over time
          </h2>
        </div>
      </div>

      <div className="trend-category-nav" aria-label="Category totals in the selected range">
        {TREND_CATEGORIES.map((item) => {
          const itemCategory = categoryFor(item);
          const itemConfig = SERIES[item];
          return (
            <button
              type="button"
              key={item}
              className={`trend-category-option trend-category-option--${item}${item === activeCategory ? ' trend-category-option--active' : ''}`}
              aria-pressed={item === activeCategory}
              onClick={() => setChosenCategory(item)}
            >
              <svg className="trend-category-option__marker" viewBox="0 0 20 20" aria-hidden="true">
                <SeriesMarker marker={itemConfig.marker} x={10} y={10} small />
              </svg>
              <span>{itemCategory.label}</span>
              <strong>{categoryTotals[item]}</strong>
            </button>
          );
        })}
      </div>

      <p className="trend-chart-card__focus" aria-live="polite">
        Latest sample:{' '}
        <strong>
          {latest} {latest === 1 ? 'error' : 'errors'}
        </strong>
        {included.length > 1 && <> · Previous sample: {previous}</>}
      </p>
      <p className="trend-chart-card__hint">Select a point to open that sample’s error report.</p>

      <p className="trend-chart-mobile-hint">Scroll sideways to see more samples.</p>
      <div className="trend-chart-scroll" tabIndex="0" aria-label="Scrollable trends chart">
        <svg
          className="trend-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ width: '100%', minWidth: `${chartWidth}px` }}
          aria-labelledby={`${titleId} ${descriptionId}`}
        >
          <desc id={descriptionId}>
            Line chart showing {activeLabel.toLowerCase()} errors across selected writing samples.
            Counts are per sample, not a score.
          </desc>

          <text
            className="trend-chart__axis-title"
            x="18"
            y={(plot.top + plot.bottom) / 2}
            textAnchor="middle"
            transform={`rotate(-90 18 ${(plot.top + plot.bottom) / 2})`}
          >
            Errors tagged
          </text>

          {Array.from({ length: tickCount + 1 }, (_, index) => {
            const value = (axisMax / tickCount) * index;
            const y = yForValue(value);
            return (
              <g key={value}>
                <line className="trend-chart__grid" x1={plot.left} x2={plot.right} y1={y} y2={y} />
                <text className="trend-chart__tick" x={plot.left - 13} y={y + 4} textAnchor="end">
                  {Number.isInteger(value) ? value : value.toFixed(1)}
                </text>
              </g>
            );
          })}

          <line
            className="trend-chart__axis"
            x1={plot.left}
            x2={plot.left}
            y1={plot.top}
            y2={plot.bottom}
          />
          <line
            className="trend-chart__axis"
            x1={plot.left}
            x2={plot.right}
            y1={plot.bottom}
            y2={plot.bottom}
          />

          {samples.map((sample, index) => {
            const x = xForIndex(index);
            const isIncluded = includedIds.has(String(sample.sampleId));
            return (
              <g key={sample.sampleId}>
                {!isIncluded && (
                  <>
                    <line
                      className="trend-chart__excluded"
                      x1={x}
                      x2={x}
                      y1={plot.top}
                      y2={plot.bottom}
                    />
                    <text
                      className="trend-chart__excluded-label"
                      x={x}
                      y={plot.top - 10}
                      textAnchor="middle"
                    >
                      Excluded
                    </text>
                  </>
                )}
                <text
                  className={`trend-chart__date${isIncluded ? '' : ' trend-chart__date--excluded'}`}
                  x={x}
                  y={plot.bottom + 27}
                  textAnchor="middle"
                >
                  {shortDate.format(new Date(sample.uploadedAt))}
                </text>
                <text
                  className={`trend-chart__sample-title${isIncluded ? '' : ' trend-chart__date--excluded'}`}
                  x={x}
                  y={plot.bottom + 47}
                  textAnchor="middle"
                >
                  {shortTitle(sample.title)}
                </text>
              </g>
            );
          })}

          {series.map(({ item, config, category, points }) => {
            if (points.length === 0) return null;
            return (
              <g key={item} className={`trend-series trend-series--${item}`}>
                <polyline
                  className="trend-series__line"
                  points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                  strokeDasharray={config.dash}
                />

                {points.map(({ sample, x, y, count }) => (
                  <g
                    key={sample.sampleId}
                    className="trend-point"
                    role="link"
                    tabIndex="0"
                    aria-label={`${sample.title}, ${category.label}: ${count} ${count === 1 ? 'error' : 'errors'}. Open error report.`}
                    onClick={() => onOpenSample(sample.sampleId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenSample(sample.sampleId);
                      }
                    }}
                  >
                    <title>{`${sample.title} — ${category.label}: ${count}`}</title>
                    <circle className="trend-point__hit" cx={x} cy={y} r="22" />
                    <circle className="trend-point__focus" cx={x} cy={y} r="11" />
                    <SeriesMarker marker={config.marker} x={x} y={y} />
                    <text className="trend-point__count" x={x} y={y - 16} textAnchor="middle">
                      {count}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      <details className="trend-table-wrap">
        <summary>View all category data as a table</summary>
        <div className="trend-table-scroll">
          <table className="trend-table">
            <thead>
              <tr>
                <th scope="col">Writing sample</th>
                {TREND_CATEGORIES.map((item) => (
                  <th key={item} scope="col">
                    {categoryFor(item).label}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => {
                const includedRow = includedIds.has(String(sample.sampleId));
                return (
                  <tr key={sample.sampleId} className={includedRow ? '' : 'trend-table__excluded'}>
                    <th scope="row">
                      <Link to={`/samples/${sample.sampleId}`}>{sample.title}</Link>
                      <span>{shortDate.format(new Date(sample.uploadedAt))}</span>
                      {!includedRow && <span>Excluded</span>}
                    </th>
                    {TREND_CATEGORIES.map((item) => (
                      <td key={item}>{sample.counts[item]}</td>
                    ))}
                    <td>{sample.totalErrors}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function shortTitle(title) {
  return title.length > 18 ? `${title.slice(0, 17)}…` : title;
}

function SeriesMarker({ marker, x, y, small = false }) {
  const size = small ? 5 : 6;

  if (marker === 'diamond') {
    return (
      <path
        className="trend-marker trend-marker--fill"
        d={`M ${x} ${y - size} L ${x + size} ${y} L ${x} ${y + size} L ${x - size} ${y} Z`}
      />
    );
  }
  if (marker === 'circle') {
    return <circle className="trend-marker trend-marker--outline" cx={x} cy={y} r={size} />;
  }
  if (marker === 'triangle') {
    return (
      <path
        className="trend-marker trend-marker--fill"
        d={`M ${x} ${y - size - 1} L ${x + size + 1} ${y + size} L ${x - size - 1} ${y + size} Z`}
      />
    );
  }
  if (marker === 'square') {
    return (
      <rect
        className="trend-marker trend-marker--outline"
        x={x - size}
        y={y - size}
        width={size * 2}
        height={size * 2}
      />
    );
  }
  return (
    <path
      className="trend-marker trend-marker--plus"
      d={`M ${x} ${y - size - 1} V ${y + size + 1} M ${x - size - 1} ${y} H ${x + size + 1}`}
    />
  );
}
