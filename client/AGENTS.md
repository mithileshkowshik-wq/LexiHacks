# Client instructions

These instructions apply to `client/` and extend the repository-level `AGENTS.md`.

## Before changing UI

Read `DESIGN.md` completely. It is the owner-approved visual specification. The brand kit in
`../lexipath_brand_assets_v2/` is the source of truth for logos, colors, and typography.

Do not reintroduce rejected patterns:

- no pill-shaped status badges;
- no large all-corner radii;
- no white text on sage;
- no uncentered wide-screen content columns;
- no second font family or theme switch;
- no raw hex values in component styles when a token exists.

## Architecture

- `src/main.jsx`: routes and top-level providers.
- `src/App.jsx`: persistent shell and routed outlet.
- `src/pages/`: route-level screens.
- `src/components/`: shared UI; reusable patterns should also appear on `/styleguide`.
- `src/lib/api.js`: the only client HTTP seam. Pages should not call `fetch()` or construct API
  URLs directly.
- `src/lib/status.js`: maps backend states to UI labels and tones.
- `src/lib/categories.js`: category labels, icons, and reclassification order.
- `src/index.css`: global tokens and base styles.
- `src/App.css`: component and page styles.

Preserve the API behavior documented in `src/lib/api.js`, especially:

- `getStudent()` returns `null` for a 404.
- `uploadSample()` sends `FormData`; do not set its `Content-Type` manually.
- Error updates use the embedded error's array index.
- Image pixels are fetched through the image endpoint, never from a raw `imagePath`.

## Commands

Run from `client/`:

```text
npm run dev
npm run build
npm run lint
npm run format:check
npm run preview
```

For UI changes, run at least `npm run lint` and `npm run build`. When layout or interaction
changes, verify the affected route in the browser at desktop and narrow widths. The design
checklist in `DESIGN.md` names the target viewport sizes.
