# LexiPath repository instructions

These instructions apply to the entire repository. More specific guidance lives in
`client/AGENTS.md` and `server/AGENTS.md` and takes precedence inside those directories.

## Product context

LexiPath helps educators review spelling and literacy errors in children's handwritten work.
An educator uploads one or more pages, Gemini proposes error classifications, and the educator
reviews, reclassifies, or dismisses each result. Trends and recommendations build on reviewed
data.

Protect these product invariants:

- Preserve the child's `written` text exactly. Never silently correct or paraphrase it.
- Dismiss errors by setting `dismissed: true`; do not delete them from `errors[]`.
- Never expose raw scan filesystem paths to the client.
- Treat uploaded scans and student information as sensitive data. Do not print, copy, commit, or
  inspect their contents unless the task specifically requires it.
- The fixed error categories are defined by `ERROR_CATEGORIES` in `server/models/sample.js`.

## Repository structure

This is not an npm workspace. Run commands from the package they belong to:

- `client/`: Vite, React, and React Router SPA.
- `server/`: Express, Mongoose, MongoDB, and Gemini integration.
- `lexipath_brand_assets_v2/`: approved logos and brand tokens.

Reference artifacts under `docs/architecture/`, `docs/design/`, `docs/testing/`, and `docs/project/` include `paths.txt`, the wireframes, API-route documentation,
and work-allocation material. They describe the original design and can be stale. When
documentation and running code disagree, confirm the intended behavior and update the relevant
documentation with the implementation.

## Working conventions

- Read the closest `AGENTS.md` before changing files in `client/` or `server/`.
- Keep changes within the user's requested scope and preserve unrelated working-tree changes.
- Search with `rg` or `rg --files` before assuming a file or pattern does not exist.
- Follow existing ES module syntax and local formatting conventions.
- Prefer small, focused changes. Do not add dependencies unless the task needs one.
- Do not edit generated output, dependency directories, `.env` files, or uploaded files.
- Never include secrets from `client/.env.local` or `server/.env` in output, tests, or commits.
- When behavior changes, add or update the narrowest useful test.
- Run the package's lint/check commands after changes and report what was actually run.

## Sources of truth

- UI and visual behavior: `client/DESIGN.md`, then the approved brand kit.
- Server data constraints: Mongoose schemas and their inline comments.
- Client/server response shapes: controller serializers and `client/src/lib/api.js`.
- Implemented routes: Express router files. Do not rely on `paths.txt` alone.

## Current product boundaries

- Upload, analysis, review, trends, recommendations, and authentication are all implemented end
  to end.
- `requireAuth` (`server/middleware/requireAuth.js`) gates every feature route
  (`/api/students`, `/api/samples`, `/api/worksheets`, `/api/recommendation`); only `/api/auth`
  itself is mounted without it, since login has to be reachable before a session exists.
- Known limitations are real gaps, not missing features: no per-teacher data scoping (any
  signed-in account can read/modify every student), no rate limiting on login, and no
  crash-recovery for an in-flight analysis job if the server restarts mid-run.
