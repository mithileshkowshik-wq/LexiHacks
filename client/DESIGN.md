# LexiPath Design System

The visual language for the LexiPath client. This is the **authoritative spec** — approved by the
project owner in July 2026 after three review passes on a live sample board. Any UI work (human or
AI agent) must follow it. If you change something here, change it deliberately and update this file.

Brand source of truth: `../lexipath_brand_assets_v2/` (`brand-tokens.json`, logo SVGs). This doc
derives from it; the brand kit always wins over anything invented.

---

## 1. The one-paragraph brief

LexiPath helps educators/therapists review AI-flagged spelling errors in children's handwritten
work. The UI is a **navy "ink" sidebar** anchoring a **warm paper content area** (scans must sit on
a light neutral ground). The signature motif is **ruled exercise-book paper** — the paper children
write on. Detailing is **gently squared** (sheets of paper, not app bubbles), statuses are written
like a **teacher's margin annotation**, and the one big curve allowed anywhere is the **bowl
corner** taken from the LP logo.

## 2. Hard rules (things the owner explicitly rejected — do not reintroduce)

1. **No capsule/pill status badges** (rounded box + colored dot). Rejected as "cliché, AI-like".
   Status is a *margin note* — see §6.
2. **No large all-corner border radii.** Radii live in the 4–8px range (cards 6px). The owner
   found >10px "too curved" and 2–3px "too squared up". 4–8px is the settled dial.
3. **Cards must never blend into the background.** White cards on the off-white paper need a firm
   border (`#d9d2c0`) *and* a real shadow (see §5). Hairline-border-only cards were rejected.
4. **Sage never carries white text** — it fails contrast. Navy (`--ink`) is the primary action
   color; sage is accent only (active nav, margin lines, hover borders, eyebrows via
   `--sage-strong`).
5. **Content column always centers**: `max-width` + `margin-inline: auto`. Never a left-pinned
   column with dead space on wide monitors.
6. **Lexend only.** One typeface, roles differentiated by weight/size/tracking (§4). No second
   font family.

## 3. Color tokens

Defined in `src/index.css` on `:root`. Use the CSS variables, never raw hex, in component styles.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#1A2433` | Sidebar bg (gradient start), primary buttons, headings/body text |
| `--ink-soft` | `#2C384A` | Primary button hover |
| `--ink-deep` | `#131B27` | Sidebar gradient end |
| `--sage` | `#7B8F7A` | Accent: active-nav inset edge, hover borders, motif margin line |
| `--sage-strong` | `#566B55` | Sage that passes text contrast on paper — eyebrows, icons on light |
| `--mist` | `#D6D4CC` | Quiet rules |
| `--paper` | `#EFE9DC` | Content-area background (warm parchment) |
| `--surface` | `#FBF8F1` | Card faces |
| `--border` / `--border-strong` | `#E0D8C8` / `#CFC6B2` | Quiet vs emphasized edges |
| card border | `#d9d2c0` | The firm card edge (between border and border-strong) |
| `--muted` | `#5C665E` | Secondary text |
| `--done` / `--pending` / `--failed` | `#4F6B4E` / `#8A6314` / `#A23A26` | Status inks — **annotation color only, never a fill** |

Navy-shell (sidebar) counterparts — light-on-dark:

```css
--shell-text: #f2f0e9;
--shell-muted: #98a1ae;
--shell-line: rgba(247, 245, 239, 0.12);   /* borders on navy */
--shell-hover: rgba(247, 245, 239, 0.07);
--shell-active-bg: rgba(123, 143, 122, 0.24);  /* sage-tinted active nav */
--shell-active-text: #cdd8cc;
```

**The former "reading comfort" mode IS the theme** (owner call, July 2026): the warm parchment
paper tones and the airier type metrics (line-height 1.9, tracking +0.02em) above are the one and
only mode. The cooler off-white variant and the sidebar toggle were removed — do not reintroduce a
theme switch. Never hardcode a paper tone — route it through a token.

## 4. Typography

Lexend variable (300–700), loaded via Google Fonts in `index.html`. Fallback `Inter, system-ui, Arial`.

| Role | Spec |
|---|---|
| Display / page titles | 500, `clamp(28px, 3.6vw, 40px)`, line-height 1.05, letter-spacing −0.01em |
| Section titles | 500, 21–22px |
| Body | 400 (300 for supporting/muted lines), 16px, line-height 1.9 |
| **Eyebrow** | 600, 12px, letter-spacing +0.14em, UPPERCASE, color `--sage-strong` |
| Status margin note | 600, 11px, letter-spacing +0.13em, UPPERCASE, status ink |
| Emphasis | 500–600. Avoid 700 for UI chrome — it renders chunky in Lexend |

## 5. Geometry & elevation

- Radii: **cards/rows 6px, buttons/inputs 5px, small chips 4px, band/empty-state 8px**. Nothing
  else. Never round all four corners of anything beyond 8px.
- **Bowl corner** — the ownable device. One rounded upper-right corner mirroring the sage bowl of
  the LP mark, applied ONLY to identity blocks (avatars, sample thumbnails, empty-state mark):
  `border-radius: 5px 20px 5px 5px;` (44px avatar) · `4px 16px 4px 4px` (60×50 thumbnail).
- Card elevation (resting): `border: 1px solid #d9d2c0;`
  `box-shadow: 0 1px 3px rgba(26,36,51,0.07), 0 12px 26px -12px rgba(26,36,51,0.22);`
- Card hover: `border-color: var(--sage);`
  `box-shadow: 0 2px 4px rgba(26,36,51,0.07), 0 18px 34px -14px rgba(26,36,51,0.3);`
- Primary button: navy fill, white text, crisp inner keyline instead of a glow:
  `box-shadow: inset 0 0 0 1px rgba(247,245,239,0.18);`
- Disabled/locked actions: transparent bg, `1.5px dashed var(--border-strong)` — visible but
  clearly inert (locked features stay discoverable, never hidden).

## 6. Status = margin note (chosen treatment "A")

A teacher's annotation, not a badge:

```css
.status-note {            /* tone class adds --st */
  position: relative; display: inline-flex; align-items: baseline;
  padding: 0 3px 7px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.13em;
  text-transform: uppercase; color: var(--st);
}
.status-note::after {     /* the slightly hand-set underline */
  content: ''; position: absolute; left: 0; right: 2px; bottom: 2px;
  height: 2px; background: currentColor; opacity: 0.5;
  transform: rotate(-1.2deg);
}
.status-note--done { --st: var(--done); }
.status-note--pending { --st: var(--pending); }
.status-note--failed { --st: var(--failed); }
```

Tone selection stays in `src/lib/status.js` (`statusFor()` maps both backend vocabularies).
The component is `src/components/StatusPill.jsx` (rename to `StatusNote` when convenient).

## 7. Ruled exercise-book motif

Faint handwriting-practice baselines + one vertical sage margin line. **Allowed in exactly four
places** — page-header band, empty state, sample/file thumbnails, and the upload drop zone
(added July 2026 with screens 2a/2b: the drop zone IS the "fresh page waiting for writing"
pattern, reusing the empty-state ground and dashed border). Do not add a fifth without updating
this doc.

```css
/* band / empty state (30px rule pitch, washed back with a white veil) */
background:
  linear-gradient(0deg, rgba(255,255,255,0.55), rgba(255,255,255,0.55)),
  repeating-linear-gradient(180deg, transparent 0 30px, rgba(26,36,51,0.1) 30px 31px);
background-color: var(--band-bg); /* #f6f0e3 */
/* sage margin line = absolutely positioned ::before, 2px wide,
   left: 56px on the band (content padding-left: 84px) */

/* thumbnail (9px pitch, margin line at left: 12px) */
background:
  repeating-linear-gradient(180deg, transparent 0 9px, rgba(26,36,51,0.12) 9px 10px),
  #fdfcf8;
```

Empty state: same ruled ground + `1.5px dashed` border, 8px radius — "a fresh page waiting for
writing", with the single primary action in it.

## 8. Layout

- Shell: CSS grid `var(--sidebar-w) 1fr` (sidebar 248px), `min-height: 100svh`.
- Sidebar: `linear-gradient(178deg, var(--ink) 0%, var(--ink-deep) 100%)`, sticky full-height;
  order: brand (white-variant logo + wordmark) → nav → therapist card pinned to the bottom
  (`margin-top: auto`).
  - Active nav item: `background: var(--shell-active-bg); color: var(--shell-active-text);
    box-shadow: inset 2.5px 0 0 var(--sage);`
  - Focus rings on the dark shell need a light outline (`--shell-active-text`), not the default sage.
- Content: `width: 100%; max-width: 1200px; margin-inline: auto;
  padding: clamp(22px, 4vw, 48px) clamp(18px, 4vw, 52px) 56px;` — this is what makes the app fit
  any monitor. Never remove the centering.
- Breakpoints: `≤1024px` sidebar narrows (200px, tighter padding); `≤760px` shell collapses to a
  single column — sidebar becomes a wrapping top bar (row direction, therapist pushed right),
  band loses its margin line and left padding.

## 9. Page header pattern (every screen starts like this)

```
[eyebrow — sage caps]        e.g. STUDENT PROFILE / CASELOAD
[page title — Lexend 500]    e.g. Wei Jie Lim
[meta chip]                  e.g. PRIMARY 4 (squared chip, 4px radius)
[actions row, right-aligned] primary + secondaries, wraps under title on narrow screens
```

On the student profile the whole header sits on the ruled **band** (§7). On list pages
(My students) it's plain, with the **search input** right-aligned in the same header row:
white surface, `#d9d2c0` border, 5px radius, 44px min-height, sage-strong search icon,
placeholder "Search students by name…", filters the grid client-side as you type.

**Form fields** (`.field` / `.field__label` / `.field__input`): the label reuses the
status-note type style in `--sage-strong` (11px, 600, +0.13em caps); the input matches the
search box exactly (surface, `#d9d2c0` border, 5px radius, 44px min-height, sage border on
focus). Forms live on an inline white card, not a modal — a new sheet of paper above the
content it adds to (see the add-student form on My students).

**Upload flow (screens 2a–2d)** follows from that rule: the wireframes draw it as a modal, but
it is implemented as a page (`/students/:id/upload`, `src/pages/UploadSamplePage.jsx`) on the
student band header. State 2a is the card with the ruled drop zone (§7), chosen-file rows
(60×50 bowl-corner thumbnails; images preview themselves, PDFs reuse the ruled thumbnail) and
the `.field` inputs; state 2b swaps the card for a quiet centered panel with a sage spinner and
the single exit action "Close — keep analysing in background". Progress is polled, never faked.
State 2c (success) reuses the 2b panel with an outlined done-ink check circle (`.done-mark` —
outline, never a fill) and two exits: "Back to profile" (secondary) and "Open error report"
(primary). State 2d (unsupported file / failed upload) is not a separate screen: an inline
`.upload-alert` — failed-ink border, mark and title on a plain surface card — appears above the
drop zone and the flow loops back to 2a with the form intact.

## 10. Copy voice

- Sentence case everywhere except eyebrows/status notes (which are structural caps).
- Buttons say exactly what happens: "Upload writing sample", not "Submit".
- Empty states invite the next action and mention the child by first name where natural.
- Locked features explain their unlock: "Available once a sample has been analysed."
- Never auto-correct or paraphrase a child's written words in any UI string — display `written`
  verbatim (product invariant, see `../AGENTS.md`).

## 11. File map

| Concern | File |
|---|---|
| Tokens, reset, base type | `src/index.css` |
| All component/page styles (flat BEM-ish classes) | `src/App.css` |
| Shell (sidebar + routed outlet) | `src/App.jsx`, `src/components/Sidebar.jsx` |
| Logo (brand + `variant="light"` for navy shell) | `src/components/Logo.jsx` |
| Buttons / status / icons / rows / empty state | `src/components/*.jsx` |
| Status vocabulary mapping | `src/lib/status.js` |
| Live rendered reference of all of the above | `/styleguide` route (`src/pages/StyleguidePage.jsx`) |

No CSS frameworks, no icon libraries, no new dependencies — inline SVG icons via
`src/components/Icon.jsx` (1.8 stroke, round caps).

## 12. Adding a new screen (checklist)

1. Page component in `src/pages/`, route in `src/main.jsx`, data via functions in `src/lib/api.js`
   (mirror `server/paths.txt`).
2. Start with the header pattern (§9); put it on the band only if the screen is about one
   student's work.
3. Cards per §5, statuses per §6, motif only per §7.
4. Check at 1920 / 1366 / 800 / 390px — centered column, top-bar collapse, no horizontal scroll.
5. Add the new pieces to `/styleguide` if they introduce a reusable pattern.

## 13. Error review screen (3a / 3b / 3c)

`src/pages/SampleReportPage.jsx` at `/samples/:sampleId`. The one screen where the child's
actual handwriting is on display, so it gets the most neutral ground in the app and the quietest
chrome around it.

**Layout.** Band header (§9, `.report__head` reuses `.profile__head`: back button → eyebrow →
sample title → subline + status note → `Mark review done`), then a two-column split
`minmax(0,55fr) / minmax(0,45fr)`. The scan column is `position: sticky` so it stays put while
the error list scrolls. At ≤1024px the split goes 60/40; at ≤900px it stacks, the scan loses its
stickiness and the list loses its max-height.

**Multi-page.** A sample spans up to 12 files and every box carries a 0-based `page`, so the
viewer shows one page at a time with a thumbnail rail (`.scan__rail`, bowl corner `3px 12px 3px
3px`, active thumb takes the sidebar's `inset 2.5px 0 0 var(--sage)`). `page` is owned by the
*page component*, not the viewer — selecting an error on the right has to be able to move the
scan to the page it sits on. Cards carry a `p.2` chip whenever the sample has more than one page.

**Zoom.** `.scan__page { width: calc(var(--zoom) * 100%) }` against the viewport, so `--zoom: 1`
*is* fit-to-width and the fit control just resets to 1. Boxes are positioned in percentages of
that element, so they scale with the scan for free — never recompute box geometry on zoom.

**Scan outlines** (`.scan-box`): normal `1.5px dashed rgba(26,36,51,0.55)` · selected `2px solid
var(--ink)` + `rgba(26,36,51,0.06)` fill + inverted tag · uncertain dashed in `--pending`. The tag
is a fixed px size so it survives 50%–300% zoom. An inverted tag is navy carrying white, which is
fine — §2 rule 4 only forbids white on *sage*.

**Categories are shape + word, never colour.** Six category colours would wreck §3, and wireframe
turn 6 removed the last icon-only cues, so `CategoryChip` always pairs the mark with the label.
One chip spec everywhere a category is named (cards, filter row, group headers, scan tags):
squared `--radius-chip`, `--accent-wash` ground, mark in `--sage-strong`.

**Card states** (`.ecard`): normal · selected · uncertain · removed.
- Selected — `border-color: var(--ink)` + `inset 2.5px 0 0 var(--sage)`, the active-nav device.
- Uncertain — dashed `--pending` with a `--pending-wash` banner strip. Derived from
  `confidenceScore < 0.6` (mirrors the server's threshold); nothing is stored for it, which is why
  "Confirm tag" writes `confidenceScore: 1` rather than setting a flag.
- Removed — dashed, transparent, the word struck through, with `Restore tag`. Dismissed errors are
  **kept, not deleted**, so the decision stays visible and reversible; they sit behind a
  `Show N removed tags` toggle at the foot of the list.

3b's reclassify and remove-confirm are **inline panels under the card** (`.epanel`), not modals —
§9's forms rule. The reclassify list omits `unsure`: an educator picking a category by hand is by
definition not unsure.

**Three deliberate departures from the wireframe**, all resolved in favour of this document:

| Wireframe | Built as | Why |
|---|---|---|
| Category chips at 18px radius | Squared 4px chip | §2 rule 1 — no capsule badges |
| Selected card `3.5px` black outline + offset shadow | Navy edge + sage inset | Would have been the app's only such treatment; the inset edge already means "active" |
| Uncertain card diagonal hatch fill | Dashed `--pending` + wash strip | Dashed already reads as "not settled"; a hatch is a new texture |

Also dropped, because the data no longer exists: the `✎ Teacher-corrected — was …` state and 3b's
optional note fields. Corrections overwrite `category` in place and no history is kept (owner call,
July 2026), so there is nothing to render them from. The outdated-recommendations banner counts
corrections **for the current visit only** and its action stays locked until the recommendations
screen exists.

**Not the ruled motif.** §7 allows exactly four places and this screen is not one of them. The
only motif use here is the page-rail thumbnails (allowed spot #3), and they show the real scan.

## 14. Error trends screen (4a / 4b)

`src/pages/ErrorTrendsPage.jsx` at `/students/:studentId/trends`. This screen is a quick reading
tool, not a dense analytics dashboard: its hierarchy is the student band, one compact three-part
summary, a slim filter row, then the chart.

**One category at a time.** The chart must not overlay all five category lines. A squared category
switcher shows shape + word + selected-sample total, and the chart focuses on the chosen category.
The default is the most frequent category for the current selection. This preserves every value
without the crossings and label connectors that made the wireframe difficult to scan.

**Progressive controls.** Date range stays visible because it changes the whole view. Individual
sample checkboxes live inside a `Choose samples` disclosure and all start selected. Excluded samples
keep their chronological positions as dashed markers, while the line connects the included points.

The summary is one bordered surface with internal dividers rather than three competing cards. On
small screens its sections stack, the category switcher scrolls horizontally, and the fixed-width
chart scrolls rather than shrinking its labels and sample names below a legible size. The complete
five-category dataset remains available in the accessible table below the chart.
