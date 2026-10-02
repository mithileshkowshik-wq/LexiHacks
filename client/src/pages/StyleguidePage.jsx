// /styleguide — the living reference for the LexiPath design system.
// Renders the real components with the real tokens so the team can see
// (and copy) the approved patterns. The written rules live in
// client/DESIGN.md; if you add a reusable pattern, show it here too.

import Button from '../components/Button.jsx';
import StatusPill from '../components/StatusPill.jsx';
import SampleRow from '../components/SampleRow.jsx';
import Logo from '../components/Logo.jsx';
import CategoryChip from '../components/CategoryChip.jsx';
import ErrorCard from '../components/ErrorCard.jsx';
import { CATEGORY_ORDER } from '../lib/categories.js';

// Display-only fixtures — nothing here touches the API.
const DEMO_SAMPLES = [
  {
    sampleId: 'demo_ready',
    title: 'Composition — “My School Holiday”',
    uploadedAt: '2026-07-12T09:15:00.000Z',
    analysisStatus: 'ANALYSED',
    imageCount: 2,
  },
  {
    sampleId: 'demo_waiting',
    title: 'Spelling exercise — Week 28',
    uploadedAt: '2026-07-10T08:02:00.000Z',
    analysisStatus: 'UPLOADED',
    imageCount: 1,
  },
];

// Screen 3 fixtures. `written` is deliberately misspelled — that is the
// point of the card: the child's word is shown exactly as written.
const DEMO_ERRORS = [
  {
    errorIndex: 0,
    n: 1,
    written: 'becos',
    intended: 'because',
    category: 'phonological',
    confidenceScore: 0.92,
    note: 'Sound-based substitution of the middle syllable.',
    locationOnScan: { page: 0, x: 0.1, y: 0.1, z: 0.2, w: 0.05 },
    dismissed: false,
  },
  {
    errorIndex: 1,
    n: 2,
    written: 'runed',
    intended: 'ran',
    category: 'morphological',
    confidenceScore: 0.48,
    note: 'Past-tense ending applied to an irregular verb.',
    locationOnScan: { page: 1, x: 0.3, y: 0.4, z: 0.15, w: 0.05 },
    dismissed: false,
  },
  {
    errorIndex: 2,
    n: 3,
    written: 'fone',
    intended: 'phone',
    category: 'orthographic',
    confidenceScore: 0.81,
    note: '',
    locationOnScan: null,
    dismissed: true,
  },
];

const noop = () => {};

const SWATCHES = [
  { name: 'Ink', varName: '--ink', use: 'sidebar · primary · text' },
  { name: 'Sage', varName: '--sage', use: 'accent only' },
  { name: 'Sage strong', varName: '--sage-strong', use: 'sage for text' },
  { name: 'Mist', varName: '--mist', use: 'quiet rules' },
  { name: 'Paper', varName: '--paper', use: 'content ground' },
  { name: 'Surface', varName: '--surface', use: 'card faces' },
];

export default function StyleguidePage() {
  return (
    <div className="guide">
      <header className="students__id">
        <span className="eyebrow">Design system</span>
        <h1 className="students__title">Styleguide</h1>
        <p className="guide__intro">
          Live render of the approved LexiPath patterns. The rules and the
          reasoning are written down in <code>client/DESIGN.md</code> — read
          it before inventing a new pattern.
        </p>
      </header>

      <Section label="Brand mark">
        <div className="guide__row">
          <Logo size={44} />
          <Logo size={44} variant="light" />
        </div>
        <p className="guide__note">
          “brand” for light surfaces, “light” for the navy sidebar. The sage
          bowl survives in both — it is where the bowl-corner radius comes
          from.
        </p>
      </Section>

      <Section label="Palette">
        <div className="guide__row">
          {SWATCHES.map((swatch) => (
            <div key={swatch.varName} className="guide__swatch">
              <div
                className="guide__chip"
                style={{ background: `var(${swatch.varName})` }}
              />
              <div className="guide__swatch-meta">
                <span>{swatch.name}</span>
                <code>{swatch.varName}</code>
                <code>{swatch.use}</code>
              </div>
            </div>
          ))}
        </div>
        <p className="guide__note">
          Always use the CSS variables from index.css, never raw hex. Navy is
          the primary action colour; sage never carries white text.
        </p>
      </Section>

      <Section label="Page header pattern">
        <span className="eyebrow">Student profile</span>
        <h2 className="students__title">Page title in Lexend 500</h2>
        <span className="grade">Primary 4</span>
        <p className="guide__note">
          Every screen opens eyebrow → title → meta chip → actions. On a
          student’s own screens the header sits on the ruled band (see the
          profile page).
        </p>
      </Section>

      <Section label="Buttons">
        <div className="guide__row">
          <Button variant="primary" icon="upload">
            Upload writing sample
          </Button>
          <Button variant="secondary" icon="trends">
            View error trends
          </Button>
          <Button
            variant="secondary"
            disabled
            disabledHint="Available once a sample has been analysed"
          >
            View recommendations
          </Button>
        </div>
        <p className="guide__note">
          Locked actions are dashed, never hidden — the educator should see
          what unlocks and when.
        </p>
      </Section>

      <Section label="Status margin notes">
        <div className="guide__row">
          <StatusPill analysisStatus="ANALYSED" />
          <StatusPill analysisStatus="REVIEWED" />
          <StatusPill analysisStatus="UPLOADED" />
          <StatusPill analysisStatus="FAILED" />
        </div>
        <p className="guide__note">
          A teacher’s annotation, not a badge: status ink never fills a
          shape. Rounded pill badges are explicitly banned (DESIGN.md §2).
        </p>
      </Section>

      <Section label="Form fields">
        <div className="guide__row">
          <label className="field">
            <span className="field__label">Name</span>
            <input
              className="field__input"
              type="text"
              placeholder="e.g. Wei Jie Lim"
            />
          </label>
          <label className="field">
            <span className="field__label">Current grade</span>
            <input
              className="field__input"
              type="text"
              placeholder="e.g. Primary 4"
            />
          </label>
        </div>
        <p className="guide__note">
          Label is the status-note type style in sage; the input matches the
          search box (surface, card border, 5px radius, 44px min-height,
          sage border on focus). Used by the add-student form.
        </p>
      </Section>

      <Section label="Sample rows">
        <div className="guide__row">
          {DEMO_SAMPLES.map((sample) => (
            <SampleRow key={sample.sampleId} sample={sample} />
          ))}
        </div>
        <p className="guide__note">
          Ready rows link to the report; analysing rows are dashed and inert.
          The thumbnail is a miniature ruled page with the bowl corner.
        </p>
      </Section>

      <Section label="Category chips">
        <div className="guide__row">
          {CATEGORY_ORDER.map((category) => (
            <CategoryChip key={category} category={category} />
          ))}
        </div>
        <p className="guide__note">
          One chip spec everywhere a category is named — cards, filters, group
          headers, scan tags. Squared at 4px, never a capsule. The six
          categories are told apart by <strong>shape and word</strong>, never
          colour: six category colours would break the palette, and a mark on
          its own fails anyone who can’t distinguish them.
        </p>
      </Section>

      <Section label="Error cards (3a)">
        <div className="guide__row guide__row--stack">
          <ErrorCard
            error={DEMO_ERRORS[0]}
            selected
            multiPage
            onSelect={noop}
            onReclassify={noop}
            onDismiss={noop}
            onConfirm={noop}
          />
          <ErrorCard
            error={DEMO_ERRORS[1]}
            multiPage
            onSelect={noop}
            onReclassify={noop}
            onDismiss={noop}
            onConfirm={noop}
          />
          <ErrorCard error={DEMO_ERRORS[2]} onRestore={noop} />
        </div>
        <p className="guide__note">
          Selected (navy edge + sage inset, mirroring the active nav item),
          uncertain (dashed in the pending ink — the AI scored below the 0.6
          threshold, so it asks for a decision), and removed. A removed tag is
          kept and restorable, never deleted: the educator’s decision has to
          stay visible and reversible.
        </p>
      </Section>

      <Section label="Scan outlines (3a)">
        <div className="guide__row">
          <div className="guide__scan">
            <span className="scan-box" style={{ left: '6%', top: '18%', width: '30%', height: '26%' }}>
              <span className="scan-box__tag">1 · Phon</span>
            </span>
            <span
              className="scan-box scan-box--selected"
              style={{ left: '44%', top: '52%', width: '34%', height: '26%' }}
            >
              <span className="scan-box__tag">2 · Orth</span>
            </span>
            <span
              className="scan-box scan-box--uncertain"
              style={{ left: '12%', top: '66%', width: '24%', height: '22%' }}
            >
              <span className="scan-box__tag">3 · Morph?</span>
            </span>
          </div>
        </div>
        <p className="guide__note">
          Boxes are positioned as percentages of the scan, so they scale with
          zoom and can never drift off the words. Dashed = flagged, solid navy
          = selected, pending ink = uncertain.
        </p>
      </Section>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <section className="guide__section">
      <span className="eyebrow">{label}</span>
      {children}
    </section>
  );
}
