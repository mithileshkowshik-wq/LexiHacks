# LexiPath

LexiPath helps educators review literacy errors in handwritten work. Upload a scan, let the AI suggest errors, review the suggestions, and explore trends and recommendations.

**Live app:** https://lexipath-583617897775.us-central1.run.app ([sign up](https://lexipath-583617897775.us-central1.run.app/signup) for an account; use fictional data only).

## Start here

- [Using the app and your .env file](docs/GETTING_STARTED.md)
- [Where to find code and documents](docs/README.md)
- [Full setup instructions](SETUP_GUIDE.md)
- [Tests and checks](docs/TESTING.md)
- [Download the optional GNHK dataset](docs/GNHK_DATASET.md)
- [App workflow, data and RAG](docs/APP-WORKFLOW.md)
- [Google Cloud deployment](GOOGLE_CLOUD.md)

On the configured laptop, open **Desktop -> LexiPath** and double-click `Start-LexiPath.cmd`. The app opens at **http://localhost:5173**. For the Atlas database, run `Create-Account-LexiPath.cmd` once and choose your own login. The old `Sandy@DAS` / `Pass@123` account belongs to the local demo database.

## Folder map

```text
project/
  client/                    Website
    src/pages/               Screens
    src/components/          Shared interface pieces
    src/lib/api.js           Calls to the backend
    .env.local               Local website settings
  server/                    Backend
    server.js                Loads settings and starts the server
    routes/                  API addresses
    controllers/             Request handling
    models/                  Database structures
    services/                AI, recommendations, image processing, email
    .env                     Private local settings
  docs/                      Guides and reference documents
  scripts/                   Checks and deployment helpers
  deploy/                    Google Cloud runtime settings
  lexipath_brand_assets_v2/   Logos and brand assets
  test-plan/                 Machine-readable test cases
  evaluation/                AI evaluation material
  performance/               Performance checks
  Dockerfile                 Cloud container build
```

## Environment settings

The backend automatically loads `server/.env` each time it starts. Use `Configure-LexiPath.cmd` to edit it, then `Restart-LexiPath.cmd` to reload it. Use `Check-LexiPath.cmd` to check settings without displaying private values.

Required settings: `MONGODB_URI` and `JWT_SECRET`. Live handwriting analysis also needs `GEMINI_API_KEY`. Use `USE_MOCK_AI=true` for demo analysis. Live recommendations use Gemini and a teaching corpus. This laptop uses `KNOWLEDGE_STORAGE_PROVIDER=mounted` and the prepared `../Data/06 App Knowledge` folder, with no Azure dependency. Use `RECOMMENDATION_USE_MOCKS=true` for demo recommendations.

Do not commit `.env` files or uploaded scans. On Google Cloud, private settings come from Secret Manager instead of a local file.

## Working on the code

The client and server are separate npm packages. For a fresh installation, use Node.js 24.11+ or 22.18+ and install dependencies in each package. This laptop already includes a suitable runtime in `../work/runtime`.

For development from PowerShell in the project folder:

```powershell
$runtime = (Resolve-Path '..\work\runtime\node-v24.21.0-win-x64').Path
$env:PATH = "$runtime;$env:PATH"
```

The Desktop shortcuts use installed Node 22 for the backend's Atlas connection and bundled Node 24 for the frontend. For manual startup on this laptop, run `& 'C:\Program Files\nodejs\node.exe' server.js` from `server`, and `npm.cmd run dev` from `client`. Stop the shortcut-managed app first to free the ports. Read [the repository guide](docs/README.md) before making changes; UI guidance lives in `client/DESIGN.md`, and agent instructions live in `AGENTS.md`.
