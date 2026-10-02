# Harsha-Merged integration record - 2026-08-12

## Target

- Branch updated locally: `Harsha-Merged`
- Remote target for push: `origin/Harsha-Merged`
- Integration worktree used: `/home/yongz/myproject/ESC-Harsha-Merged-integration`
- Original dirty worktree left in place: `/home/yongz/myproject/ESC-Project-C3-T1-Harsha-Merged`

## Sources included

1. Merged committed evaluation/image-preprocessing work from `feat/image-preprocessing-evaluation` into `Harsha-Merged`.
2. Carried over the current local source/test/documentation updates from `feat/worksheet-page-sections` into the integration worktree.
3. Resolved the only real merge conflict in `evaluation/scripts/evaluate-error-detection.mjs` by keeping the shared `evaluation/lib/evaluationMetrics.mjs` flow from the evaluation branch and preserving the newer reporting fields from the local update:
   - missing prediction files
   - failed model predictions
   - missing/failed sample rate
   - p95 latency
   - per-category exact-match metrics

## Not included intentionally

- Raw sample scans under `samples/` were not copied or staged, because repository instructions treat uploaded/student work as sensitive.
- Local Word/PDF handoff documents matching `LexiPath_Test_Case_Tables*.docx` and `LexiPath_Test_Case_Tables*.pdf` were not copied or staged.
- Dependency directories, build output, `.env`, and generated local install artifacts were not staged.

## Main changes now on `Harsha-Merged`

- AI evaluation harness and comparison scripts under `evaluation/`.
- Scan preprocessing before AI analysis under `server/services/imagePreprocessor.js` and `server/services/errorClassificationEngine.js`.
- Evaluation providers/adapters for Gemini, OpenRouter, and Cloudflare in `evaluation/lib/modelProviders.mjs`.
- Human-vetted and candidate evaluation labels plus model prediction/report artifacts under `evaluation/`.
- Recommendation engine/report updates, worksheet section catalogue, and recommendation route/test updates under `server/`.
- Client API timeout/debug behavior, recommendation page worksheet-link behavior, and protected-route/session tests under `client/`.
- Documentation updates for test commands, evaluation workflow, server/client setup, and worksheet page scoping.

## Verification run after merge resolution

Installed package dependencies in the temporary integration worktree before testing:

- `client`: `npm install`
- `server`: `npm install`

Commands that passed:

- `server`: `npm test` — 328 tests, 327 passed, 1 skipped, 0 failed.
- `server`: `npm run lint` — passed.
- `client`: `npm test` — 42 tests, 42 passed, 0 failed.
- `client`: `npm run lint` — passed with one pre-existing warning in `client/src/pages/AccountPage.jsx` about a missing `session` dependency in `useEffect`.
- `client`: `npm run build` — passed.
- root/evaluation: `node --test evaluation/test/*.test.mjs` — 9 tests, 9 passed, 0 failed.
- targeted Prettier check for changed files — passed.

Notes:

- Full package-level `npm run format:check` still reports pre-existing formatting warnings in unrelated files. I did not reformat the entire repo to avoid a broad unrelated diff.
- Targeted Prettier was applied only to files changed by this integration.
