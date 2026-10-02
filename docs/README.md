# Project guide

Start with [Getting started](GETTING_STARTED.md) to run the app and understand `.env`.

## Where to find things

| Folder or file                                     | What it is for                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `../client/src/pages/`                             | Website screens: sign-in, students, uploads, review, and account             |
| `../client/src/components/`                        | Shared interface pieces                                                      |
| `../client/src/lib/api.js`                         | Requests from the website to the backend                                     |
| `../client/src/index.css`, `../client/src/App.css` | Website styles                                                               |
| `../server/server.js`                              | Loads settings, connects to MongoDB, starts the backend                      |
| `../server/app.js`                                 | Connects URLs to their routes; serves the built website in cloud deployments |
| `../server/routes/`                                | Which API addresses are available                                            |
| `../server/controllers/`                           | What happens for each request                                                |
| `../server/models/`                                | Database structures: accounts, students, samples, recommendations            |
| `../server/services/`                              | AI analysis, recommendation logic, image processing, email                   |
| `../server/middleware/`                            | Login checks, upload handling, error handling                                |
| `../server/.env`                                   | Private local configuration; automatically read by the backend               |
| `../scripts/`                                      | Setup, configuration checks, cloud deployment, test coverage checks          |
| `../deploy/`                                       | Public Google Cloud runtime settings                                         |
| `../lexipath_brand_assets_v2/`                     | Logos and approved branding                                                  |
| `../client/DESIGN.md`                              | Website design rules                                                         |
| `../test-plan/`                                    | Machine-readable test plan                                                   |
| `../evaluation/`                                   | AI evaluation material                                                       |
| `../performance/`                                  | Performance checks                                                           |

## How a writing sample moves through the app

```text
Upload page -> backend upload route -> sample stored in MongoDB
                                  -> scan saved under server/samples
                                  -> Gemini analyses the scan
Review page <- detected errors saved in MongoDB
```

The educator reviews the AI suggestions, corrects categories or dismisses an error, and the trends and recommendations use that reviewed information. The original written words stay intact.

## Documents

- [Getting started](GETTING_STARTED.md): everyday use and environment variables.
- [Full setup guide](../SETUP_GUIDE.md): installation and all service settings.
- [Tests](TESTING.md): the existing test commands and how to run them.
- [App workflow and RAG](APP-WORKFLOW.md): current workflow, data storage and teaching-resource retrieval.
- [Google Cloud](../GOOGLE_CLOUD.md): deployment steps for later.
- `design/`: original HTML wireframes.
- `architecture/`: original routes, paths, and sequence diagrams.
- `testing/`: Word and PDF test-case documents.
- `project/`: original work allocation.
- `reports/`: pilot results and worksheet-scoping notes.
- `archive/`: earlier plans and merge records.

The original reference documents describe older designs. For current behavior, use the running code and current guides.
