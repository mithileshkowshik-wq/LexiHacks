# LexiPath on Google Cloud

This repository is prepared for a **single Google Cloud Run service** hosting both the React website and Express API. The app is now live in `lexihacks`. See [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md) for its URL, tested behavior, and the existing infrastructure reused. The setup stages below describe the fuller static-NAT configuration; those network resources are not part of the current deployment.

## How it works

```text
Browser -> Cloud Run (website + API)
                 |-> MongoDB Atlas: accounts, students, analysis results
                 |-> Cloud Storage: uploaded scans and rendered PDF pages
                 |-> Cloud Storage: private teaching corpus (read-only mount)
                 |-> Gemini: handwriting analysis and RAG recommendations
                 |<- Secret Manager: private runtime settings
```

The Dockerfile builds the website and copies it into `server/public`, which Express already serves. The browser calls `/api` on the same website address. No cloud URL is baked into the website, and there is no separate frontend hosting service to configure.

MongoDB Atlas can be hosted on Google Cloud. Firestore and Cloud SQL are different databases and cannot replace this project's MongoDB connection without application changes.

The existing upload code uses files under `/app/server/samples`. Cloud Run mounts a private Cloud Storage bucket at that path so files survive instance replacement. Google Cloud's normal container filesystem is temporary. The bucket is not public: scans are served through authenticated API routes.

Teaching resources use a separate private bucket, mounted read-only at `/app/knowledge`. The runtime service account receives `storage.objectViewer` on that bucket. The same manifest reader works locally against `Data/06 App Knowledge` and in Cloud Run against the mount, so Azure credentials are not required. See [Cloud Storage volume mounts](https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts).

The app starts analysis after returning the upload response. Deployment therefore keeps one instance available and CPU allocated between requests. This supports the current asynchronous work for a hackathon demo, but **does not guarantee recovery if an instance restarts during analysis**. Durable job processing is a separate future change.

## What was added

- `Dockerfile`: a Node.js 24 Linux image, website build, production backend dependencies, non-root runtime, and Cloud Run port 8080.
- `.dockerignore` and `.gcloudignore`: an allowlist excluding local environment files, Windows dependencies, uploaded scans, Git history, and unrelated documents from cloud builds.
- `deploy/cloud-run.env.yaml`: non-secret production settings.
- `scripts/setup-gcp.ps1`: creates cloud prerequisites when explicitly run later.
- `scripts/deploy-gcp.ps1`: builds and deploys through Google Cloud; Docker Desktop is not needed for this path.
- `scripts/build-knowledge.py`: extracts teaching text and packages approved PDFs from Data.
- `scripts/upload-knowledge.ps1`: validates and uploads only the prepared teaching bundle.
- `scripts/create-cloud-account.ps1` and `server/scripts/bootstrapAccount.js`: create a login with your chosen private password; no public demo password is automatically seeded in the cloud.
- `/api/health` (and local compatibility route `/healthz`): returns HTTP 200 when MongoDB is connected and 503 otherwise, without exposing student or account information.
- Tests for readiness and safe account creation.

Local `.env` files and Desktop Start/Stop shortcuts continue to work as before. The cloud build reads none of the local `.env` files.

## Where environment variables go

| Setting | On your laptop | On Google Cloud |
|---|---|---|
| `MONGODB_URI` | `server/.env`, pointing to Atlas `/LexiPath` | Secret Manager, with the exact same database capitalization |
| `GEMINI_API_KEY` | `server/.env` | Secret Manager |
| `JWT_SECRET` | `server/.env` | Secret Manager; use a separate cloud secret |
| `ADMIN_PASSWORD` | Entered privately in Create-Account shortcut | Secret Manager, used only by account-creation job |
| Knowledge provider/root | `mounted`, `../../Data/06 App Knowledge` | `mounted`, `/app/knowledge` read-only bucket mount |
| Worksheet section path | Prepared corpus's `_manifests/worksheet-sections.json` | `/app/knowledge/_manifests/worksheet-sections.json` |
| AI mode/model/timeout | `server/.env` | `deploy/cloud-run.env.yaml` |
| `CLIENT_URL` | `http://localhost:5173` | Deployment script sets the Cloud Run HTTPS URL |
| `PORT` | 5000 | Cloud Run supplies 8080 |
| `VITE_API_URL` | `client/.env.local` | Dockerfile builds the website with `/api` |

Secrets are injected into the server at runtime. They are not embedded in the container image or sent to the browser. Version 1 of each secret is selected by default; use `-SecretVersion 2` after adding version 2 to all selected secrets when rotating them.

Recommendations are configured for live Gemini and the private teaching corpus. No Azure account or SAS token is needed in mounted mode. Password-reset email is optional and needs Resend.

When enabling an optional service, add its non-secret settings to the YAML file and its secret bindings to the deployment script. Otherwise a later deployment with the default files will reset the runtime configuration to the base settings.

## Deploy later: five stages

### 1. Choose your Google Cloud project

Create or select a project with billing enabled. Install the [Google Cloud CLI](https://docs.cloud.google.com/sdk/docs/install), sign in with `gcloud auth login`, and open PowerShell in:

```text
C:\Users\somes\Desktop\LexiPath\project
```

Your signed-in account needs permission to enable APIs, manage IAM, create the listed resources, build source, deploy Cloud Run, and act as the runtime and build service accounts. A project administrator may need to grant these permissions if you are using a team project. See [source deployment permissions](https://docs.cloud.google.com/run/docs/deploying-source-code).

Use a dedicated project or review existing resources first. The setup script uses the `lexipath-*` names and adds permissions to matching resources if they already exist. It does not delete resources.

### 2. Create the prerequisites

Replace `your-project-id` with the project's actual ID:

```powershell
.\scripts\setup-gcp.ps1 -ProjectId your-project-id
```

This enables the required APIs and creates:

- A private scan bucket named `your-project-id-lexipath-scans`.
- A private knowledge bucket named `your-project-id-lexipath-knowledge`, read-only to the runtime account.
- A runtime account with access to that bucket and only the app's secrets.
- A build account with Cloud Run Builder permissions.
- Four empty secrets; you add their values in the Console next.
- A dedicated network, subnet, Cloud NAT gateway, and fixed outbound IP address.

The fixed outbound IP is printed when setup finishes. It allows Atlas to admit the app without allowing every IP address. These resources can incur charges, including NAT and the always-running Cloud Run instance. Choose your region with `-Region`; use the same region for all subsequent commands and your Atlas cluster where possible. Default: `us-central1`.

### 3. Add the database and secrets

Use the existing Atlas cluster or create a dedicated one near the selected region. Give the application database user read/write access to `LexiPath`, preserving its capitalization. Add the printed fixed outbound IP with `/32` in Atlas Network Access. Add your laptop IP separately only if you need local access to this cloud database.

Use a fresh cloud database initially. Local Windows scan paths cannot be used by a Linux container; transferring existing samples requires a deliberate database and file migration. Deployment does not transfer laptop data automatically.

In Google Cloud Console -> Secret Manager, add **version 1** to each secret:

| Secret name | Value |
|---|---|
| `lexipath-mongodb-uri` | Atlas URI including `/LexiPath`, for example `mongodb+srv://USER:PASSWORD@CLUSTER/LexiPath?retryWrites=true&w=majority` |
| `lexipath-gemini-api-key` | Your Gemini API key |
| `lexipath-jwt-secret` | A separate long random signing secret |
| `lexipath-admin-password` | Your chosen login password: at least 8 characters, a capital letter, a number, and a special character |

Encode special characters in Atlas username/password URI components as Atlas instructs. Keep secret values out of this guide, Git, and command history. The deployment script references secret names, not values.

### 4. Deploy and create your login

Upload the generated bundle first. The script rejects extra files and validates the manifest-listed paths; it does not upload the original Data folder wholesale. If resources changed, rebuild the bundle with the Desktop `Rebuild-Knowledge-LexiPath.cmd` shortcut before uploading.

```powershell
.\scripts\upload-knowledge.ps1 -ProjectId your-project-id
.\scripts\deploy-gcp.ps1 -ProjectId your-project-id
.\scripts\create-cloud-account.ps1 -ProjectId your-project-id -Username your-username -Email your-email@example.com
```

The upload command copies the prepared corpus to the private knowledge bucket. Deployment verifies the manifests, builds on Google Cloud, deploys the service, then sets `CLIENT_URL` to the returned HTTPS address. The account command runs a one-time job using the private password from Secret Manager. It leaves an existing account password unchanged; an app account already created in the same Atlas database can also be used.

`--allow-unauthenticated` makes the website and login page publicly reachable. All feature APIs continue to require the app's JWT login. If your organization blocks public Cloud Run access, coordinate with the project administrator before publishing.

### 5. Verify the deployed app

- Visit the returned HTTPS address and sign in with your chosen credentials.
- Create a fictional student and upload a small synthetic JPG/PNG or PDF.
- Wait for analysis; check review, corrections, trends, live recommendations and worksheet PDF downloads.
- Open `/api/health` and confirm `{ "status": "ok" }`.
- Verify scans remain readable after a new revision is deployed.
- Check Cloud Run and account-job logs for failures without logging keys or scan contents.

Keep total multipart uploads below Cloud Run's HTTP/1 request limit of 32 MiB. PDF rendering and mounted-file writes consume memory; start with small demo documents and increase resources only if needed.

## Limits and costs to understand

The configuration uses one minimum instance, one maximum instance, 1 CPU, 2 GiB memory, and four concurrent HTTP requests. CPU stays allocated for analysis between requests. This is a small demo configuration, not a durable queue or a production scaling design; revision rollouts can overlap instances.

The existing app gives signed-in educators access to all students and has no login rate limiting. Use fictional hackathon data. A real school deployment needs per-account access control, abuse protection, a durable analysis queue/retry strategy, and operational data policies.

Setting minimum instances to zero while retaining the current background analysis design can interrupt processing. To reduce costs after the event, delete the Cloud Run service and remove the demo NAT/network/storage resources once any wanted data is retained; resources other than the service can continue charging independently. Do not delete the scan bucket or Atlas database until you have retained the data you need.

## Verification status

The frontend production build passed. The full server suite passed with 390 tests passing and 1 optional live test skipped; all 48 client tests and 28 focused recommendation/storage tests passed. Server lint passed; client lint has one existing account-page warning. Setup, upload and deployment scripts parse successfully as PowerShell. Actual local Atlas + Gemini + teaching-folder retrieval, worksheet download and saved intervention reports passed using temporary fictional data, which was removed.

The Google Cloud CLI is installed inside the Desktop LexiPath workspace. The existing Linux cloud deployment, mounted teaching resources, Atlas connection, and live Gemini workflow have now passed an end-to-end cloud verification with synthetic data. The static-NAT setup script was not used for the existing service; see CLOUD_DEPLOYMENT.md.

## Official references

- [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract)
- [Cloud Storage mounts](https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts)
- [Background CPU and billing](https://docs.cloud.google.com/run/docs/configuring/billing-settings)
- [Secret Manager integration](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
- [Static outbound IP](https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip)
- [Atlas network access](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
