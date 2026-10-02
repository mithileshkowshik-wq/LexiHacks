# Testing LexiPath

Run these commands from the project root unless a package directory is specified.

## Verification and test commands

The client and server are separate npm packages, so run commands from the package directory that
owns the tests. The normal suites use mock AI/external services unless explicitly marked live.

### Server: deterministic tests, lint, and formatting

```text
cd server
npm test
npm run lint
npm run format:check
```

`npm test` runs the Node built-in test suite under `server/test/` and
`server/services/*.test.js`. The opt-in live recommendation test is present in the suite but skips
unless the live command below sets `RUN_LIVE_RECOMMENDATION_TESTS=true`. The
`errorClassificationEngine.integration.test.js` MongoDB integration tests also skip cleanly when
`MONGODB_URI` is not configured.

### Server: opt-in live external recommendation test

```text
cd server
npm run test:live
```

This reads `server/.env`, disables recommendation mocks, and runs
`server/test/live-recommendation.test.js` against live Gemini/Azure configuration. It requires the
Gemini recommendation key or `GEMINI_API_KEY` plus the Azure manifest/container variables described
in `server/README.md`. Do not use real student data as fixtures.

### Client: component tests, lint, and build

```text
cd client
npm test
npm run lint
npm run build
npm run format:check
```

`npm test` runs the React/DOM unit and component tests in `client/test/` with Node's built-in test
runner and the project preload in `client/test-setup/preload.mjs`.

### Client: Playwright browser E2E

Install Playwright's browser once per machine, then run the deterministic browser suite:

```text
cd client
npx playwright install chromium
npm run test:e2e
```

`npm run test:e2e` starts the synthetic mock API fixture from
`server/test-support/e2eServer.js` and a Vite dev server with
`VITE_API_URL=http://127.0.0.1:5000/api`, then runs `client/e2e/revised-plan.spec.js` headlessly.
It does not require live Gemini, Azure, email, or production MongoDB.

For a headed walkthrough of the same implemented E2E flow:

```text
cd client
npm run test:e2e:demo
```

### Cross-package coverage manifest check

```text
node scripts/verify-lexipath-test-coverage.mjs
```

This validates that every revised test-plan ID in
`test-plan/lexipath-integration-revised-cases.json` appears exactly once across implemented client
and server test files.

### Mock-mode API performance smoke test

```text
node performance/mock-mode-smoke.mjs
```

This starts the same synthetic E2E API fixture and reports p50/p95/max latency for stable
authenticated API routes. It is not a live-AI load test.

### AI evaluation scripts

```text
node evaluation/scripts/validate-ground-truth.mjs
node evaluation/scripts/evaluate-error-detection.mjs
node evaluation/scripts/evaluate-error-detection.mjs evaluation/predictions/<model-or-pipeline>
```

The evaluation scripts operate only on human-vetted JSON under
`evaluation/ground-truth-vetted/`. Model-generated candidate labels are not ground truth until a
human reviewer has accepted or corrected them.

Do not commit uploaded student scans or environment files.
