# LexiPath Playwright E2E, Performance, and AI Evaluation Execution Plan

This file is a step-by-step execution checklist for closing the remaining testing/evaluation gaps while keeping the current documentation, sequence diagrams, class diagram, and testing tables mostly stable.

Primary goals:

1. Keep the existing deterministic test suite working.
2. Use Playwright for browser E2E, including visible demo execution when needed.
3. Add CI so tests run automatically.
4. Add mock-mode performance measurement for stable features.
5. Add opt-in live external testing for Gemini, Azure, and authentication.
6. Prepare human-vetted ground truth for AI accuracy evaluation.
7. Evaluate Gemini and lower-cost/free alternatives for accuracy, speed, and recommendation quality.
8. Improve recommendation usefulness by narrowing worksheet suggestions to specific page ranges.
9. Record only necessary report/documentation updates.

---

## Ground rules

- Use synthetic or explicitly approved sample files only.
- Do not commit API keys, JWT secrets, Azure SAS tokens, live MongoDB credentials, or real student data.
- Keep live external tests opt-in. They must not run in normal CI unless secrets/costs are intentionally configured.
- Keep deterministic regression tests separate from live AI/Azure tests.
- Do not fake accuracy results. If full labelling is not finished, report either methodology-only or a clearly labelled small pilot.
- Do not rewrite all existing documentation tables unless a claim is now wrong.
- After every code change, run the narrow relevant check first, then the package-level verification.

---

## Phase 0 — Baseline verification

Purpose: confirm the current branch is stable before adding new work.

Commands:

```bash
cd /home/yongz/myproject/ESC-Project-C3-T1-Harsha-Merged

git status --short --branch
node scripts/verify-lexipath-test-coverage.mjs

cd server
npm test
npm run lint

cd ../client
npm test
npm run lint
npm run build
npm run test:e2e
```

Expected outcome:

- Traceability passes with 236/236 IDs.
- Server tests pass.
- Client tests pass.
- Client build passes.
- Playwright E2E passes.

If this fails:

- Fix the failure before adding new CI/live/performance/model-evaluation work.

---

## Phase 1 — Add CI for existing deterministic tests

Purpose: close the “no continuous integration” gap.

Create:

```text
.github/workflows/test.yml
```

CI should run on:

- push
- pull request

Recommended CI jobs:

1. Install server dependencies.
2. Run server tests.
3. Run server lint.
4. Install client dependencies.
5. Install Playwright Chromium.
6. Run client tests.
7. Run client lint.
8. Run client build.
9. Run Playwright E2E.
10. Run traceability validator.

Suggested command sequence inside CI:

```bash
npm ci --prefix server
npm test --prefix server
npm run lint --prefix server

npm ci --prefix client
npx --prefix client playwright install --with-deps chromium
npm test --prefix client
npm run lint --prefix client
npm run build --prefix client
npm run test:e2e --prefix client

node scripts/verify-lexipath-test-coverage.mjs
```

Local verification after adding CI:

```bash
git diff --check
node scripts/verify-lexipath-test-coverage.mjs
cd server && npm test && npm run lint
cd ../client && npm test && npm run lint && npm run build && npm run test:e2e
```

Report update required:

- Remove “No continuous integration” if CI is added and passing.
- Add CI to the Testing section as automatic regression enforcement.

---

## Phase 2 — Playwright visible demo mode

Purpose: use Playwright, not Selenium, to mimic a human using the browser while keeping the existing Playwright investment.

Add a headed/demo Playwright script, for example in `client/package.json`:

```json
{
  "scripts": {
    "test:e2e:demo": "playwright test e2e/revised-plan.spec.js --headed --project=chromium --workers=1"
  }
}
```

Optional: create a separate demo spec if the current `revised-plan.spec.js` is too fast or too technical:

```text
client/e2e/demo-walkthrough.spec.js
```

Recommended visible demo flows:

1. UC7 — protected route redirects to login, then valid login succeeds.
2. UC1 — upload page opens for a signed-in educator.
3. UC2 — sample report displays categorised errors and hides raw paths.
4. UC5 — reclassify/dismiss/restore/confirm/add missed error.
5. UC4 — trends page updates with filters/date range.
6. UC3/UC6 — view, generate, or refresh recommendations.
7. UC8/UC9 — password change and reset behaviours.

Recommended demo options in `client/playwright.config.js` or the demo spec:

- `headless: false` for demo command only.
- `slowMo` through an environment variable if using a custom config.
- screenshots on failure.
- video on failure or retain-on-failure.

Example command:

```bash
cd client
npm run test:e2e:demo
```

Report update required:

- Keep automated Playwright E2E as the main E2E evidence.
- Mention headed Playwright demo as demonstration evidence, not as a replacement for CI/headless regression.

---

## Phase 3 — Mock-mode performance testing

Purpose: measure LexiPath’s own Express/MongoDB/client/API performance without Gemini/Azure variability.

Recommended tool: k6 or Artillery.

Suggested structure:

```text
performance/
  README.md
  lexipath-mock-load.js
  results/
```

Target routes/features:

1. Login.
2. Get student list.
3. Get one student.
4. Get sample report.
5. Get trends.
6. Get latest recommendations.
7. Generate mock recommendations.

Metrics to record:

- p50 latency.
- p95 latency.
- p99 latency.
- request error rate.
- requests per second.
- concurrent virtual users.

Suggested acceptance targets for a small demo deployment:

| Feature                        | Suggested target |
| ------------------------------ | ---------------: |
| Login                          |     p95 < 500 ms |
| Student list                   |     p95 < 800 ms |
| Sample report                  |    p95 < 1000 ms |
| Trends                         |    p95 < 1500 ms |
| Mock recommendation generation |    p95 < 3000 ms |
| Error rate                     |             < 1% |

Report update required:

- If mock-mode performance is run, change “Performance never measured” to “Mock-mode API performance measured; live AI/load testing remains future work.”
- Include a small performance results table.

---

## Phase 4 — Opt-in live Playwright E2E with Gemini, Azure, and auth

Purpose: verify the real external integration path without making normal tests flaky or expensive.

Add a separate live test command:

```json
{
  "scripts": {
    "test:e2e:live": "RUN_LIVE_E2E=true playwright test e2e/live-external.spec.js --project=chromium --workers=1"
  }
}
```

Create:

```text
client/e2e/live-external.spec.js
```

Required environment variables should be documented, not hardcoded:

```text
RUN_LIVE_E2E=true
LIVE_BASE_URL=http://localhost:5173
LIVE_API_URL=http://localhost:5000/api
LIVE_USERNAME=...
LIVE_PASSWORD=...
GEMINI_API_KEY=...
AZURE_* or worksheet storage configuration
JWT_SECRET=...
MONGODB_URI=...
```

Live flow should be small:

1. Login with a synthetic/demo account.
2. Upload one approved/synthetic sample.
3. Wait for Gemini analysis to complete.
4. Open the sample report.
5. Generate recommendations.
6. Confirm recommendation rationale and evidence appear.
7. Open/proxy one worksheet PDF from Azure.
8. Clean up created test data if possible.

Rules:

- Skip the test unless `RUN_LIVE_E2E=true`.
- Never run live test in normal CI.
- Never print secrets.
- Use only approved samples.
- Keep timeout high enough for Gemini/Azure latency.

Report update required:

- Mention live E2E as opt-in external verification.
- Do not mix live results with deterministic CI pass counts.

---

## Phase 5 — Ground-truth candidate generation for AI accuracy

Purpose: prepare a human-vetted ground truth dataset for PS4 error detection/classification.

Suggested structure:

```text
evaluation/
  samples/
  ground-truth-candidates/
  ground-truth-vetted/
  predictions/
  reports/
  scripts/
    generate-candidate-groundtruth.mjs
    evaluate-error-classification.mjs
```

Ground truth file format:

```json
{
  "sampleId": "sample-001",
  "sourceFile": "evaluation/samples/sample-001.pdf",
  "taskType": "ESSAY",
  "grade": "P3",
  "errors": [
    {
      "id": "gt-001",
      "written": "becos",
      "intended": "because",
      "category": "phonological",
      "locationOnScan": {
        "page": 0,
        "x": 0.42,
        "y": 0.31,
        "z": 0.08,
        "w": 0.03
      },
      "rationale": "Sound-based spelling approximation."
    }
  ]
}
```

Workflow:

1. Put approved sample files under `evaluation/samples/`.
2. Generate candidate annotations using Gemini or another model.
3. Save candidates under `evaluation/ground-truth-candidates/`.
4. Human reviewer vets/corrects candidates.
5. Save corrected files under `evaluation/ground-truth-vetted/`.
6. Only files in `ground-truth-vetted/` count as ground truth.

Report wording:

- Correct: “model-generated candidate labels were manually vetted before use as ground truth.”
- Incorrect: “the model generated the ground truth.”

---

## Phase 6 — AI model benchmark

Purpose: compare Gemini, DeepSeek, and other low/free-cost alternatives for accuracy, speed, and recommendation usefulness.

Separate PS4 and PS6.

### PS4: scan-to-error detection/classification

Use direct vision models only for direct comparison:

- Gemini vision model.
- Qwen2.5-VL or Qwen-VL if accessible.
- Llama Vision if accessible.
- Other available low-cost VLMs.

DeepSeek text models should be evaluated separately as an OCR + text pipeline unless using a vision-capable DeepSeek endpoint.

Metrics:

- detection precision.
- detection recall.
- detection F1.
- classification accuracy on matched errors.
- per-category precision/recall.
- confusion matrix.
- localisation IoU if boxes are available.
- average latency.
- p95 latency.
- timeout/failure rate.
- approximate cost per sample.

### PS6: recommendation generation

Text-only models can be compared here:

- Gemini text model.
- DeepSeek Chat/V3.
- DeepSeek R1 if useful.
- Qwen text model.
- Llama text model.
- Mistral/Gemma/Phi if accessible.

Recommendation metrics:

- cites real evidence only.
- targets the correct categories.
- does not hallucinate worksheet IDs.
- rationale is useful and specific.
- page range is specific if page-level worksheet metadata exists.
- latency.
- cost.

Output report:

```text
evaluation/reports/model-comparison.md
evaluation/reports/model-comparison.json
```

Important:

- Do not fabricate results.
- If only a small pilot is completed, label it as a pilot.

---

## Phase 7 — Narrow recommendation resources to 2–3 pages

Implementation status: implemented on `feat/worksheet-page-sections`; see
`docs/reports/WORKSHEET_PAGE_SCOPING_DEVIATIONS.md` for the one deployment-specific catalogue deviation.

Purpose: improve PS6 so it recommends actionable worksheet sections rather than a whole 100+ page file.

Add or prepare page-level worksheet metadata:

```text
server/data/worksheetSections.json
```

Example structure:

```json
[
  {
    "worksheetId": "phonics-pack-1",
    "title": "Phonological Awareness Pack",
    "pageStart": 12,
    "pageEnd": 14,
    "targetCategories": ["phonological"],
    "skill": "sound-letter correspondence",
    "difficulty": "P2-P3",
    "description": "Short vowel substitution practice."
  }
]
```

Validation rules:

- `pageStart >= 1`.
- `pageEnd >= pageStart`.
- page range should be small, ideally 2–3 pages.
- worksheet ID must exist.
- selected section must match reviewed error categories.
- AI must not invent worksheet IDs or page numbers.

UI update:

```text
Recommended worksheet: Phonological Awareness Pack, pages 12–14
```

Tests to add:

- recommendation validator rejects unknown page ranges.
- recommendation output includes pageStart/pageEnd.
- UI displays page range.
- recommendation remains grounded in evidence.

Report update required:

- Update PS6 recommendation logic description.
- Mention section/page-level worksheet scoping as a refinement.

---

## Phase 8 — Minimal report/documentation updates

Do not rewrite everything. Update only stale or changed claims.

Required updates if all phases are completed:

1. Testing section:
   - Add CI.
   - Add Playwright headed demo mode.
   - Add mock-mode performance results.
   - Add live E2E as opt-in.
   - Add ground-truth accuracy evaluation or pilot.

2. Section 5.6 / gaps:
   - Remove “No automated E2E suite.”
   - Remove “No CI pipeline” only if CI is added and passing.
   - Change “Performance never measured” if mock-mode performance is run.
   - Keep “No full AI accuracy measurement” unless a vetted evaluation is completed.

3. Section 5.7 crucial properties:
   - Update Functionality evidence to 236/236 traceability.
   - Update Performance if mock-mode results exist.
   - Update Accuracy only with real vetted results.

4. Appendix E:
   - Remove “No way to add an error the AI missed.”
   - Keep security/crash-recovery limitations unless actually fixed.

5. Diagrams:
   - Replace unclear class diagram arrows with Mermaid class diagram.
   - Combine the two use case diagrams into one complete diagram.
   - Keep sequence diagrams unless a real product flow changes.

Suggested report change log:

```text
Post-final testing updates:
1. Added GitHub Actions CI for deterministic regression checks.
2. Added Playwright headed demo execution for visible E2E walkthroughs.
3. Added/retained Playwright automated E2E coverage across UC1–UC9.
4. Added mock-mode performance testing for core static API flows.
5. Added opt-in live external E2E plan for Gemini, Azure, and auth.
6. Added human-vetted ground-truth workflow for AI accuracy evaluation.
7. Clarified class diagram relationships and merged use case diagrams.
```

---

## Suggested execution order

If time is limited:

1. Phase 0 — baseline verification.
2. Phase 1 — CI.
3. Phase 2 — Playwright headed demo mode.
4. Phase 3 — mock-mode performance testing.
5. Phase 8 — update report stale claims.
6. Phase 5 — ground-truth format and candidate generation.
7. Phase 6 — small pilot model benchmark.
8. Phase 4 — live external E2E.
9. Phase 7 — page-level recommendation scoping.

If the report is due very soon:

1. Baseline verification.
2. CI.
3. Headed Playwright demo command.
4. Mock-mode performance smoke test.
5. Documentation updates.
6. Ground-truth methodology only, unless vetted labels are ready.

---

## Final deliverables checklist

- [ ] CI workflow added and passing.
- [ ] Existing deterministic tests still pass.
- [ ] Playwright E2E still passes headless.
- [ ] Playwright headed demo mode works.
- [ ] Mock-mode performance test added.
- [ ] Performance result table generated.
- [ ] Live external E2E is opt-in and documented.
- [ ] Ground-truth JSON schema created.
- [ ] Candidate labels generated for approved samples.
- [ ] Human-vetted ground truth saved separately.
- [ ] Gemini evaluation run against vetted ground truth.
- [ ] Optional DeepSeek/Qwen/Llama model comparison run.
- [ ] Recommendation page-range scoping designed or implemented.
- [ ] Report stale claims updated.
- [ ] Class diagram replaced with clearer relationship notation.
- [ ] Combined use case diagram added.
- [ ] No secrets or real student data committed.
