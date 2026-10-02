# LexiPath client

React and Vite frontend for managing students, uploading writing samples, reviewing
AI-classified literacy errors beside the original scan, and opening grounded intervention
worksheets.

## Setup

Create `client/.env.local`:

```text
VITE_API_URL=http://localhost:5000/api
```

Optional, only needed against a genuinely live (non-mock) backend:

```text
# Default 12000ms is too short for live recommendation generation, which
# chains two sequential Gemini calls plus Azure retrieval - a real run was
# observed taking ~24s. Too short doesn't lose the result (it still saves
# server-side), it just shows a false "API request timed out" instead of
# the report that was about to be ready.
VITE_API_TIMEOUT_MS=60000

# Logs request/response details (method, url, status, timing) to the
# console - useful when diagnosing exactly this kind of timeout.
VITE_DEBUG_API=true
```

Then run:

```text
npm install
npm run dev
```

The API server should normally be running on port `5000`. `vite.config.js` also proxies
`/api` requests to `http://localhost:5000` in dev, so this would work without
`VITE_API_URL` set at all — but setting it explicitly, as above, is what's actually
configured locally and is the more reliable path. See the repo root's `SETUP_GUIDE.md`
for the full setup walkthrough.

## Scripts

```text
npm run dev
npm run build
npm test
npm run test:e2e
npm run test:e2e:demo
npm run lint
npm run format:check
npm run format
npm run preview
```

### Tests

Run the React unit/component tests:

```text
npm test
```

This uses Node's built-in test runner with `test-setup/preload.mjs` and discovers tests under
`client/test/`.

Run the deterministic Playwright browser E2E suite:

```text
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e` uses `playwright.config.js` to start both required services automatically:

- `node ../server/test-support/e2eServer.js` on port `5000`, backed by synthetic data,
  mock AI/recommendations, and an in-memory MongoDB server.
- Vite on port `4173` with `VITE_API_URL=http://127.0.0.1:5000/api`.

The E2E suite currently runs `e2e/revised-plan.spec.js` headlessly and does not need live Gemini,
Azure, email, or production MongoDB credentials.

Run the headed browser walkthrough for demos/debugging:

```text
npm run test:e2e:demo
```

Run static checks and production build:

```text
npm run lint
npm run build
npm run format:check
```

Use `npm run format` only when you intentionally want Prettier to rewrite files.

## Structure

- `src/main.jsx`: route definitions.
- `src/App.jsx`: persistent application shell.
- `src/pages/`: routed screens, including the auth flow (`LoginPage`, `ForgotPasswordPage`,
  `ResetPasswordPage`, `AccountPage`).
- `src/components/`: shared UI components, including `RequireAuth`, the route guard that
  redirects to login when there's no session.
- `src/lib/api.js`: client API boundary.
- `src/lib/session.js`: client-side session/token storage.
- `src/lib/status.js` and `src/lib/categories.js`: display rules for backend values.
- `src/index.css` and `src/App.css`: design tokens and application styles.
- `/styleguide`: rendered component and design-system reference.

Read `DESIGN.md` before changing UI and `AGENTS.md` before changing client code. Pages should use
`src/lib/api.js` rather than calling `fetch()` directly.

All Gemini, MongoDB, Azure, and SAS credentials belong in the server's ignored environment file.
Never expose them through `VITE_*` variables.

## Recommendations

The student recommendations route displays reviewed evidence, intervention strategies, and
approved worksheets. Worksheet links send only a stable ID to `/api/worksheets/:worksheetId/file`;
the browser never receives an Azure SAS token or signed Blob URL.
