# LexiPath server

Express and Mongoose API for student records, uploaded writing samples, AI classification, and
educator review.

## Setup

Create `server/.env` (see `.env.example` for the full list of variables, and the repo
root's `SETUP_GUIDE.md` for a complete walkthrough):

```text
MONGODB_URI=<MongoDB connection string>
GEMINI_API_KEY=<Gemini API key>
JWT_SECRET=<any long random string — required, login throws without it>
PORT=5000
```

Optional AI settings:

```text
GEMINI_MODEL_NAME=<model name>
GEMINI_TIMEOUT_MS=<milliseconds>
GEMINI_MAX_RETRIES=<count>
GEMINI_RETRY_BASE_MS=<milliseconds>
ERROR_CONFIDENCE_THRESHOLD=<number from 0 to 1>
```

Then run:

```text
npm install
npm start
```

The client expects the API at `http://localhost:5000/api` (see `client/README.md`).

## Scripts

```text
npm start
npm test
npm run test:live
npm run lint
npm run format:check
npm run format
npm run seed:students
```

### Tests

Server tests use Node's built-in test runner. Most test files live in `test/`; the error
classification engine also has tests under `services/`.

Run the normal deterministic suite:

```text
npm test
```

This runs unit, controller/component, recommendation, authentication, and isolated-database
integration tests. It also discovers `test/live-recommendation.test.js`, but that live test skips
unless `RUN_LIVE_RECOMMENDATION_TESTS=true`. The older
`services/errorClassificationEngine.integration.test.js` suite requires `MONGODB_URI` and skips
cleanly when no MongoDB URI is available.

Run one focused test file while developing:

```text
npm test -- test/recommendationEngine.test.js
npm test -- services/errorClassificationEngine.test.js
```

Run the opt-in live external recommendation test:

```text
npm run test:live
```

`npm run test:live` loads `server/.env`, sets `RUN_LIVE_RECOMMENDATION_TESTS=true`, disables
recommendation mocks with `RECOMMENDATION_USE_MOCKS=false`, and runs only
`test/live-recommendation.test.js`. It requires live Gemini and Azure recommendation settings:
`GEMINI_RECOMMENDATION_API_KEY` or `GEMINI_API_KEY`, plus the Azure storage/manifest variables in
the Intervention Recommendations section below. Keep this command opt-in because it can be slow,
costly, quota-limited, and non-deterministic.

Run static checks:

```text
npm run lint
npm run format:check
```

Use `npm run format` only when you intentionally want Prettier to rewrite files.

`npm run seed:students` creates the two canonical demo students (Wei Jie Lim /
Primary 4, Aisha Rahman / Primary 3) so everyone develops against the same
data. Safe to run more than once — it skips a student whose name already
exists. `node seedAccount.js` does the same for the demo login account.

## Structure

- `app.js`: the Express app itself - middleware, route mounting, the 404 catch-all, and the error
  handler. This is the single source of truth `server.js` and the test suite both build on.
- `server.js`: connects to MongoDB and starts `app.js` listening.
- `routes/`: URL definitions and multipart upload configuration.
- `controllers/`: HTTP handling and public response serialization.
- `services/errorClassificationEngine.js`: Gemini request, validation, retry, and background
  analysis behavior.
- `models/`: Mongoose schemas.
- `middleware/errorHandler.js`: API error response formatting.
- `samples/`: local uploaded files; never use real student work as a test fixture.

See `AGENTS.md` for implementation constraints and the repository root `README.md` for client
setup.

## Authentication

`POST /api/auth/login` (`routes/auth.js`, `models/account.js`) checks real credentials and signs
a stateless JWT (`utils/jwt.js`, `JWT_SECRET`) instead of just returning the account. Every route
except `/api/auth/*` is mounted behind `middleware/requireAuth.js` (see `app.js`), which verifies
that token on every request and rejects anything missing or invalid with a 401 - the API itself
now actually enforces sign-in, not just the client's navigation gate (`RequireAuth.jsx`).

What this still doesn't do: the token only proves _someone_ signed in, not _which_ teacher owns
which student. `GET /api/students` still returns every student in the database rather than
scoping to the caller, and `Student.teacherId` is accepted but never enforced against the token's
identity. Scoping queries to the signed-in teacher is future work - it needs deciding what
"ownership" of a student even means (one teacher? a shared caseload per organisation?) before it
can be enforced, which is a product question as much as a code change.

## Error Classification Engine

`server/services/errorClassificationEngine.js` is the AI core: it takes an
uploaded `Sample` and produces the categorised errors written back onto it.
There is no separate `SampleReport` model in this codebase — errors are
embedded on `Sample` (see `server/models/sample.js`), so the "report" this
engine returns is just `{ errors, illegibleNote }`, the two fields `Sample`
already has.

### Running it

```
cd server
npm install
npm test        # normal deterministic suite; live recommendation test skips by default
```

No `.env` variables are required to run in mock mode (the default). Copy
`.env.example` to `.env` and fill in `MONGODB_URI` to run the rest of the
server.

### Mock mode vs real mode

- **Mock mode** (default, active whenever `GEMINI_API_KEY` is unset, or force
  with `USE_MOCK_AI=true`): returns a fixed fixture with one error per
  category plus one deliberately low-confidence entry, so downstream slices
  (review screen, trends, recommendations) can build against a stable shape
  without an API key or network latency.
- **Real mode**: set `GEMINI_API_KEY` (and optionally `USE_MOCK_AI=false`) to
  call Gemini vision. Requires `npm install` to have pulled in
  `@google/genai`. Gemini SDK APIs move quickly - if `ai.models.generateContent`
  or its response shape has changed since this was written, check the current
  Gemini API docs before relying on real mode; `callModelWithRetry` in
  `errorClassificationEngine.js` is the only place that would need updating.

**Testing the FAILED path without a real broken file**: in mock mode, a
sample whose `imagePath` or `originalFilename` contains the word "corrupt"
(case-insensitive) simulates an unreadable upload and rejects with the same
message the real path uses for an unreadable file.

### Environment variables

| Variable                     | Default                            | Meaning                                                                                                                 |
| ---------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`             | (empty)                            | Gemini API key. Leave blank to force mock mode. Never sent to the client.                                               |
| `USE_MOCK_AI`                | `true` if no API key, else `false` | Explicit override for mock vs real mode.                                                                                |
| `GEMINI_MODEL_NAME`          | `gemini-flash-latest`              | Gemini model used for the vision call. The `-latest` alias is deliberate: pinned versions get retired for new API keys. |
| `GEMINI_TIMEOUT_MS`          | `90000`                            | Per-attempt timeout before the request is treated as failed. This engine's own default is 90000ms (image analysis is slow); the recommendation engine reads the same variable but defaults to 30000ms if unset. |
| `GEMINI_MAX_RETRIES`         | `2`                                | Additional attempts after a timeout/error/malformed response, with exponential backoff.                                 |
| `GEMINI_RETRY_BASE_MS`       | `500`                              | Base backoff delay before a retry; doubles each attempt, quadrupled again for rate-limit (429) errors specifically.     |
| `ERROR_CONFIDENCE_THRESHOLD` | `0.6`                              | Confidence score below which a detected error is flagged "uncertain" for the educator.                                  |

### Integration point for Person 2 (Sample Upload)

`runAnalysis(sampleId)` is the background job. Call it **after** the sample
upload route has already sent its response — do not `await` it in the
request handler:

```js
// in the POST /api/samples handler, after res.status(202).json(sample):
runAnalysis(sample._id);
```

It always resolves the sample to `status: "ANALYSED"` or `status: "FAILED"`
(with a human-readable `analysisError`) — it never leaves a sample stuck
mid-analysis, even if every retry fails.

### `locationOnScan` coordinate system

`{ page, x, y, z, w }`. `page` is a 0-based index into the sample's `pages`
array (matching upload order), since a sample can span several images or PDF
pages - `x, y, z, w` are only meaningful relative to that one page's image.
`x, y, z, w` are normalised 0–1 against the full page image: `x, y` is the
bounding box's top-left corner, `z, w` are its width and height. This was
chosen here in the absence of a written agreement with Person 4 (the review
screen owner) — confirm it still matches what they render before wiring up
the real review screen. (It does: this is already what ScanViewer.jsx renders
against.)

## Error Correction

`PATCH /api/samples/:sampleId/errors/:errorIndex` (sampleController.reclassifyError) is the
therapist-overrules-the-AI endpoint. `errorIndex` addresses a position in the sample's embedded
`errors` array — there's no separate error id, since the sub-schema is `{ _id: false }` (see
`SAMPLES` in paths.txt for why errors are embedded rather than a standalone collection).

Body is a partial patch — send only what changed:

```text
{ category }           reclassify (must be one of ERROR_CATEGORIES)
{ dismissed: true }    remove the tag   { dismissed: false }  restore it
{ confidenceScore }    1 when the educator confirms an uncertain tag
```

To record an error the AI missed, use `new` in place of the index and send the child's text exactly
as written with an educator-selected category:

```text
PATCH /api/samples/:sampleId/errors/new
{ written, category }
```

"Remove" flips `dismissed`, it never deletes the array entry — an index that stayed stable is what
lets the client re-request the exact same error later (e.g. to restore it) without a lookup. There
is deliberately no correction-history (`previousCategory`/`correctionNote`/`correctedAt`): an
earlier draft of this feature planned one, but reclassifying was shipped as an in-place overwrite
with no audit trail (see `client/DESIGN.md`) — flag this to the class hand-in if that history turns
out to matter for grading, since it would need a real schema change to add back.

## Intervention Recommendations

`server/services/recommendationEngine.js` is the second AI service: it reasons over a student's
reviewed errors to produce worksheet picks and intervention strategies. It's a lightweight
retrieval-augmented pipeline, not a single prompt — see `server/controllers/recommendationController.js`
for the two things it actually generates:

- **Per-sample worksheet picks** (`POST /api/samples/:sampleId/recommendations`): up to three
  approved PDF worksheets, matched to that sample's error categories.
- **Per-student intervention report** (`POST /api/students/:studentId/recommendations`): a set of
  named strategies with a rationale grounded in the student's actual error counts and misspellings,
  stored as the student's one `RecommendationReport` (regenerating replaces it - there is no
  history/lifecycle by design, see `models/recommendationReport.js`).

### How the grounding works

Worksheet text/strategy rationale isn't hand-authored by the model from nothing - it's retrieved
from a private Azure Blob Storage container the server reads through a manifest file, never the
whole store at once:

1. A manifest (`AZURE_KNOWLEDGE_MANIFEST_PATH`) lists many small Markdown documents; only that list
   is loaded first, not the corpus itself.
2. Documents are fetched individually (8 at a time), each capped at `AZURE_MAX_DOCUMENT_BYTES` -
   anything larger is rejected rather than read.
3. Fetched documents are cached in memory and ranked locally by simple keyword overlap against the
   student's error categories/words/grade level - not embeddings, not a vector search.
4. Only the top 12 ranked documents are sent to Gemini as grounding context.
5. Worksheet picks are constrained to a separate approved-PDF manifest
   (`AZURE_ASSET_MANIFEST_PATH`) - Gemini can only choose a worksheet that's on that list, never
   invent one, and the client only ever receives a stable `worksheetId`
   (`GET /api/worksheets/:worksheetId/file` proxies the real file) - never an Azure path or SAS URL.

### Mock mode vs real mode

Same pattern as the Error Classification Engine: **mock mode** (`RECOMMENDATION_USE_MOCKS=true`,
the default) needs no Azure/Gemini credentials and picks from a small fixture worksheet list by
category match, so the rest of the team can build the UI against a stable shape. **Real mode**
(`RECOMMENDATION_USE_MOCKS=false`) requires the Azure and Gemini variables below.

### Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `RECOMMENDATION_USE_MOCKS` | `true` | Mock mode switch, independent of the Error Classification Engine's own `USE_MOCK_AI`. |
| `GEMINI_RECOMMENDATION_API_KEY` | falls back to `GEMINI_API_KEY` | Separate key so recommendation quota/billing can be tracked apart from classification, if desired. |
| `GEMINI_RECOMMENDATION_MODEL` | `gemini-flash-latest` | Model used for strategy/worksheet generation. |
| `AZURE_STORAGE_ACCOUNT_NAME` / `AZURE_STORAGE_CONTAINER_NAME` / `AZURE_STORAGE_SAS_TOKEN` | (empty) | Read-only container SAS - keep the real token only in the git-ignored `.env`, never `.env.example`. |
| `AZURE_KNOWLEDGE_MANIFEST_PATH` | `_manifests/gemini-canonical-markdown.jsonl` | List of retrievable Markdown documents. |
| `AZURE_ASSET_MANIFEST_PATH` | `_manifests/blob-upload-manifest.json` | List of approved worksheet PDFs. |
| `WORKSHEET_SECTIONS_PATH` | `server/data/worksheetSections.json` | Curated 2–3-page section metadata. Live entries must reference worksheet IDs from the active Azure asset manifest; use an ignored private override when those IDs should not be committed. |
| `AZURE_FETCH_TIMEOUT_MS` | `15000` | Per-blob fetch timeout. |
| `AZURE_MAX_DOCUMENT_BYTES` / `AZURE_MAX_MANIFEST_BYTES` / `AZURE_MAX_WORKSHEET_BYTES` | `1048576` / `5242880` / `20971520` | Byte ceilings enforced while streaming each blob type - oversized blobs are rejected (502), never partially buffered. |

### Worksheet page-level scoping

Worksheet recommendations select an approved 2–3-page section rather than an unrestricted whole
PDF. `server/data/worksheetSections.json` is the committed catalogue for deterministic mock mode.
Each active section must reference an existing worksheet ID, use `pageStart >= 1`, end on or after
its start page, span exactly two or three pages, and name only supported error categories. Gemini
receives the approved section list and must copy the worksheet ID and both page numbers exactly;
server validation rejects invented IDs or ranges before persistence.

Live Azure worksheet IDs are derived from the private asset manifest. Configure
`WORKSHEET_SECTIONS_PATH` to an ignored, reviewed JSON file containing those live IDs. If no live
sections are configured, recommendation generation fails closed instead of falling back to a broad
whole-PDF recommendation. The client displays the approved range and opens the PDF at its first
suggested page.
