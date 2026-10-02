# LexiPath — Local Setup & Testing Guide

For this configured laptop, use [the current workflow guide](docs/APP-WORKFLOW.md). Atlas, live Gemini, and the local teaching package are already configured. Live recommendations support `KNOWLEDGE_STORAGE_PROVIDER=mounted`; no Azure credentials are needed in that mode. Use the Desktop shortcuts for the installed runtimes.

For anyone on the team setting this up fresh. Written against `main` as of commit
`fec37da` (2026-08-11). Client and server are separate npm packages, not a monorepo —
install and run both independently.

The server runs on **port 5000** (`server.js`'s default, matching `vite.config.js`'s
dev proxy target and `playwright.config.js`'s E2E config). This guide has the full
environment-variable list — `README.md`, `server/README.md` and `client/README.md`
intentionally don't duplicate it, see step 4b for the client env file.

## 1. Prerequisites

- **Node.js 24.11+ or 22.18+** (this repo is developed on Node 24; Vite 8 / React 19 / Express 5 need
  something reasonably current — no `engines` field is set in either package.json, so
  there's no hard floor, but don't try this on Node 16).
- **npm** (ships with Node).
- **Git**.
- **MongoDB** — either:
  - MongoDB Community Server installed locally ([download](https://www.mongodb.com/try/download/community)), running on the default port 27017, or
  - a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster (get its connection string).
- *(Optional, for live AI instead of mock mode)* a Gemini API key, and — for live
  intervention recommendations specifically — a prepared teaching corpus (mounted locally or from Google Cloud Storage), or Azure credentials if using the legacy Azure provider.
  Ask a teammate for both; don't request new ones unless you need to.

## 2. Clone / update the repo

```bash
git clone https://github.com/SomeshAgrawal1318/ESC-Project-C3-T1.git
cd ESC-Project-C3-T1
git checkout main
git pull
```

## 3. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

## 4. Configure environment variables

Only the **server** needs a `.env` file. Every Gemini/Mongo/Azure/JWT/Resend secret lives
there — the client never sees them (`client/README.md` is correct about this part).

Create `server/.env`:

```
# --- shared ---
MONGODB_URI=mongodb://127.0.0.1:27017/lexipath
PORT=5000

# --- Auth ---
JWT_SECRET=<generate one — command below>
JWT_EXPIRES_IN=24h
RESEND_API_KEY=<optional — only needed to actually send password-reset emails>
EMAIL_FROM=LexiPath <onboarding@resend.dev>
CLIENT_URL=http://localhost:5173

# --- Error Classification Engine ---
GEMINI_API_KEY=<from a teammate, or leave blank to run in mock mode>
USE_MOCK_AI=false
GEMINI_MODEL_NAME=gemini-flash-latest
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_RETRIES=2
ERROR_CONFIDENCE_THRESHOLD=0.6

# --- Intervention Recommendations ---
# Leave this on mocks unless you specifically need to test live retrieval — it needs
# the Azure block below, which most people won't have on hand.
RECOMMENDATION_USE_MOCKS=true
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**To test live recommendations** (optional — mocks are fine for most work), ask a
teammate for the Azure credentials and add:

```
RECOMMENDATION_USE_MOCKS=false
AZURE_STORAGE_ACCOUNT_NAME=<from teammate>
AZURE_STORAGE_CONTAINER_NAME=<from teammate>
AZURE_STORAGE_SAS_TOKEN="<from teammate — keep the quotes, it contains & characters>"
AZURE_KNOWLEDGE_MANIFEST_PATH=_manifests/gemini-canonical-markdown.jsonl
AZURE_ASSET_MANIFEST_PATH=_manifests/blob-upload-manifest.json
```

SAS tokens expire (check the `se=` field inside the token string) — if recommendations
start 502ing, that's the first thing to check; ask for a fresh token or fall back to
`RECOMMENDATION_USE_MOCKS=true`.

**Fully offline option:** leave `GEMINI_API_KEY` blank (or set `USE_MOCK_AI=true`) and
you don't need any Gemini or Azure credentials at all — analysis returns a fixed fixture.
Good enough for UI work; you only need real credentials to see live AI output.

### 4b. Client env file

Create `client/.env.local` (also git-ignored, not in the repo history — every fresh
clone needs this created by hand, it won't already be there for you):

```
VITE_API_URL=http://localhost:5000/api
```

This points the client straight at the server on port 5000. `vite.config.js` also
proxies `/api` to the same port in dev, so this would technically work unset too — but
setting it explicitly, as above, is what's actually configured locally.

## 5. Start MongoDB

- Local install: run `mongod`, or start the MongoDB service.
- Atlas: nothing to start locally — just make sure `MONGODB_URI` points at your cluster.

## 6. Seed demo data

```bash
cd server
node seedStudents.js   # creates two demo students (Wei Jie Lim, Aisha Rahman)
node seedAccount.js    # creates the demo login account
```

Both are safe to re-run — they skip anything that already exists. There is **no
self-registration** — `seedAccount.js` is the only way to get a login. It creates:

```
username: Sandy@DAS
password: Pass@123
```

## 7. Run the app

Two terminals:

```bash
cd server && npm run dev   # nodemon server.js — restarts on file changes, http://localhost:5000
```

```bash
cd client && npm run dev   # Vite dev server, http://localhost:5173
```

Open `http://localhost:5173` and log in with the seeded account above.

## 8. Run the automated tests

All of the following are **self-contained** — none of them need MongoDB running or any
real API keys. They spin up an in-memory MongoDB and run in mock-AI mode internally.

```bash
# Server: unit + integration tests (Node's built-in test runner)
cd server && npm test

# Client: unit tests (jsdom + React Testing Library)
cd client && npm test

# Client: end-to-end tests (Playwright — starts its own server + client + in-memory DB)
cd client
npx playwright install     # one-time, downloads browser binaries
npm run test:e2e
```

Linting/formatting (run in both `server/` and `client/`):

```bash
npm run lint
npm run format:check
```

## 9. Manual smoke-test checklist

- [ ] Log in with the seeded demo account
- [ ] Upload a writing sample (JPG, PNG or PDF)
- [ ] Wait for analysis, open the review screen, reclassify and dismiss a tag
- [ ] Confirm the trends chart reflects the correction
- [ ] Open recommendations for the student
- [ ] Log out, use "forgot password" (needs `RESEND_API_KEY` configured to actually
      receive the email — without it the request still succeeds, it just can't deliver)
- [ ] Log back in, change the password from the account page

## 10. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `"JWT_SECRET is not configured"` crash on login | Step 4 skipped — add `JWT_SECRET` to `server/.env` and restart. |
| Client can't reach the API at all | Server isn't actually on port 5000 — check `server/.env`'s `PORT`. |
| `ECONNREFUSED` connecting to Mongo | MongoDB isn't running, or `MONGODB_URI` is wrong. |
| AI always returns the same fixture | You're in mock mode (`USE_MOCK_AI` unset/true or no `GEMINI_API_KEY`) — expected, set a real key for live analysis. |
| Recommendations return 502 | Azure SAS token has likely expired — see step 4. |
| Playwright can't launch a browser | Run `npx playwright install` once from `client/`. |
