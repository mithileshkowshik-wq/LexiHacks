// The category count row above the error list (wireframe 3a). Each chip is a
// real toggle: pressing one narrows the list to that category, pressing it
// again clears the filter. Categories with nothing in them are dropped
// rather than shown as "(0)".
//
// Counts are of live errors only — a removed tag stops being counted, which
// is the whole point of removing it.

import { CATEGORY_ORDER } from '../lib/categories.js';
import CategoryChip from './CategoryChip.jsx';

export default function CategoryFilter({ counts, active, onToggle }) {
  const shown = CATEGORY_ORDER.filter((category) => counts[category] > 0);
  if (shown.length === 0) return null;

  return (
    <div className="cat-filter" role="group" aria-label="Filter errors by category">
      {shown.map((category) => {
        const on = active === category;
        return (
          <button
            key={category}
            type="button"
            className={`cat-filter__btn${on ? ' cat-filter__btn--on' : ''}`}
            aria-pressed={on}
            onClick={() => onToggle(on ? null : category)}
          >
            <CategoryChip category={category} count={counts[category]} />
          </button>
        );
      })}
    </div>
  );
}
