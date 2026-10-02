// The one category chip spec, used everywhere a category is named: on error
// cards, in the filter row, in group headers and on the scan's box tags
// (wireframe turn 6 called for a single spec across all of them).
//
// Squared, not a capsule — DESIGN.md §2 rule 1 rejected pill badges, so this
// is the 4px chip geometry the grade chip already uses. The mark never
// appears without its word.

import Icon from './Icon.jsx';
import { categoryFor } from '../lib/categories.js';

export default function CategoryChip({ category, short = false, count, className = '' }) {
  const { label, short: abbr, icon } = categoryFor(category);
  return (
    <span className={`cat-chip ${className}`.trim()}>
      <Icon name={icon} size={10} className="cat-chip__mark" />
      <span>{short ? abbr : label}</span>
      {count !== undefined && <b className="cat-chip__count">({count})</b>}
    </span>
  );
}
