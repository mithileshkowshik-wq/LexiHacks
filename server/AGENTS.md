# Server instructions

These instructions apply to `server/` and extend the repository-level `AGENTS.md`.

## Architecture

The server uses ES modules and follows this flow:

```text
server.js -> routes -> controllers -> services/models -> middleware/errorHandler.js
```

- Keep the error handler registered after all routes.
- Controllers set `res.status(...)` and then throw; Express 5 forwards rejected async handlers.
- Keep response serialization centralized in `toClientStudent()` and `toClientSample()`.
- Never add `imagePath`, `_id`, or `__v` to public response shapes without an explicit contract
  change.
- The client identifies embedded errors by array index, so do not splice `errors[]`.

## Implemented route groups

- `/api/auth`: login, forgot/reset password, change password, account. The only router mounted
  without `requireAuth`, since login has to be reachable before a session exists.
- `/api/students`: list, create, fetch one, list a student's samples, and fetch trends.
- `/api/samples`: list, upload, fetch one, serve images, mark reviewed, and update errors.
- `/api/worksheets`: proxy a worksheet PDF from Azure.
- `/api/recommendation`: placeholder only, not the real thing — actual recommendation generation
  is under `/api/students/:studentId/recommendations` and `/api/samples/:sampleId/recommendations`
  (`recommendationController.js`, `recommendationEngine.js`).

Read the router and controller before changing a route. `docs/architecture/paths.txt` is an older design
document and differs from the implementation in status names and response envelopes.

For date-only trend query parameters:

- accept `YYYY-MM-DD`;
- construct and compare dates in UTC;
- treat `from` as inclusive;
- implement an inclusive `to` day as an exclusive boundary at midnight of the next UTC day.

## Data and AI invariants

- `Sample.errors` is embedded data. Dismiss rather than delete.
- Preserve `written` exactly as submitted by the model/student workflow.
- `locationOnScan` coordinates remain normalized in the `0..1` range.
- A sample moves through `UPLOADED`, `ANALYSED`, `REVIEWED`, or `FAILED`.
- Pass `answerKey` to Gemini only for non-essay tasks and only as reading context.
- Validate Gemini output before saving it.
- Background analysis must leave a sample in either `ANALYSED` or `FAILED`, not indefinitely in
  `UPLOADED`.
- Keep educator-facing failure text free of stack traces and secrets.

## Environment and uploads

`server/.env` is local and must not be read into output or committed. Beyond `MONGODB_URI`,
`GEMINI_API_KEY`, and `PORT`, the server also reads `JWT_SECRET` (required — login throws
without it), `JWT_EXPIRES_IN`, `CLIENT_URL`, `RESEND_API_KEY`/`EMAIL_FROM` (password-reset
email), `USE_MOCK_AI`, `RECOMMENDATION_USE_MOCKS`, `NODE_ENV`, the `AZURE_*` group (worksheet
storage), and `GEMINI_RECOMMENDATION_*` settings — see `.env.example` for the full list with
defaults, and `README.md` for the Gemini retry/model settings.

Uploads are stored under `samples/<studentId>/`. Treat everything there as sensitive and do not
use real uploads as fixtures. Tests should create synthetic data or mock persistence.

## Commands

Run from `server/`:

```text
npm test
npm run lint
npm run format:check
npm start
```

For server changes, run the focused test first, then the full test suite and lint. Tests use
Node's built-in test runner and live in `test/`.
