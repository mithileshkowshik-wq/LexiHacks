# Using LexiPath on your laptop

Everything is installed. The main Desktop folder is `C:\Users\somes\Desktop\LexiPath`.

## Everyday use

1. Double-click `Start-LexiPath.cmd` in that folder.
2. Open http://localhost:5173.
3. For Atlas, double-click `Create-Account-LexiPath.cmd` once and sign in with your chosen account. `Sandy@DAS` / `Pass@123` applies only to the old local demo database.
4. Open a student, upload a fictional writing sample as JPG, PNG, or PDF, and wait for analysis.
5. Review the suggestions, adjust categories or dismiss an error, then explore trends and recommendations.
6. Use `Stop-LexiPath.cmd` when finished. Your saved data stays on disk/in the database.

Use `Restart-LexiPath.cmd` after changing settings. Use `Check-LexiPath.cmd` to see which settings are present without displaying any keys.

## The simple folder map

```text
LexiPath/
  Start-LexiPath.cmd          Run the app
  Stop-LexiPath.cmd           Stop the app
  Restart-LexiPath.cmd        Reload settings
  Configure-LexiPath.cmd      Open server settings
  Check-LexiPath.cmd          Check settings without showing secrets
  Create-Account-LexiPath.cmd Create your chosen app login in Atlas
  Rebuild-Knowledge-LexiPath.cmd Rebuild teaching resources and restart
  Data/                      Original teaching files and generated App Knowledge package
  project/                   The Git repository; open this in your editor
    README.md                Start reading here
    client/                  Website code
      .env.local             Local website settings
    server/                  Backend and AI code
      .env                   Your private settings
    docs/                    Guides and reference documents
    scripts/                 Setup/check/deployment helpers
    deploy/                  Google Cloud settings
  outputs/                   Guides and shortcut implementation
  work/                      Installed runtime, download cache, logs, local database files
```

Open `project` in your editor when working on the code. The website/backend folders keep their existing structure, so their imports and Docker build continue to work.

## How your .env works

Your supplied file is now at:

```text
C:\Users\somes\Desktop\LexiPath\project\server\.env
```

The backend reads this file automatically when it starts. You do not execute the file or paste its contents into a terminal. Each setting is written as `NAME=value`. Keep the filename `.env`, without `.txt` after it.

| Setting                    | What it controls                                                  |
| -------------------------- | ----------------------------------------------------------------- |
| `MONGODB_URI`              | Database containing accounts, students, and results               |
| `GEMINI_API_KEY`           | Access to Gemini handwriting analysis                             |
| `JWT_SECRET`               | Signing and checking login sessions                               |
| `USE_MOCK_AI`              | `false` for live analysis, `true` for fixed demo responses        |
| `RECOMMENDATION_USE_MOCKS` | `false` for live recommendations, `true` for demo recommendations |
| `KNOWLEDGE_ROOT`           | Prepared teaching corpus folder used by live recommendations      |
| `RESEND_API_KEY`           | Optional password-reset email delivery                            |
| `PORT`                     | Keep `5000` for these local shortcuts                             |
| `CLIENT_URL`               | Keep `http://localhost:5173` for local password-reset links       |

To change a setting:

1. Double-click `Configure-LexiPath.cmd`.
2. Change the needed value and save the file.
3. Double-click `Restart-LexiPath.cmd`.

The running backend keeps the values it loaded at startup until it restarts. Do not put private keys into the client's environment file. `client/.env.local` only needs `VITE_API_URL=http://localhost:5000/api` for this laptop.

Live analysis needs a working Gemini key and internet access. Live recommendations now use `Data/06 App Knowledge` and Gemini; Azure is no longer needed in the configured mounted mode. Read [the app workflow guide](APP-WORKFLOW.md) for the data map and recommendation flow.

## If something does not work

- Settings changes do not appear: save the file and restart.
- Login works but scan analysis fails: check the Gemini key, model access, and quota.
- Recommendations fail: check `KNOWLEDGE_ROOT`, the generated manifests, and Gemini access. Rebuild the teaching package after adding source resources.
- Database cannot connect: for Atlas, check access and the exact `/LexiPath` database name. The Desktop launcher skips starting local MongoDB when Atlas is selected.
- The shortcut reports missing settings: open Configure and add the indicated values.

Logs live under `work/logs`. They may contain internal details, so avoid sharing whole log files without checking them.

## Google Cloud later

Follow [GOOGLE_CLOUD.md](../GOOGLE_CLOUD.md). On Google Cloud, Secret Manager supplies the private settings; the local `.env` file is excluded from cloud builds.
