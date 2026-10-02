# LexiPath is live on Google Cloud

Open https://lexipath-583617897775.us-central1.run.app and sign in with your existing LexiPath account. The cloud app uses the same Atlas database as your laptop. You do not need to leave the laptop running.

## What runs where

- **Cloud Run** hosts the website and API together, in project `lexihacks`, region `us-central1`, service `lexipath`.
- **MongoDB Atlas** stores accounts, students, errors, and saved recommendation reports.
- **Gemini** analyses uploaded writing and generates recommendations. Both AI mock switches are disabled.
- **Private Cloud Storage** keeps new writing samples in `lexihacks-lexipath-scans` and teaching resources in `lexihacks-lexipath-knowledge`.
- **Secret Manager** supplies the existing cloud database, Gemini, login-signing, and email credentials. Your local `.env` stays on your laptop.

The teaching bucket contains the approved package: 895 text chunks, six source PDFs, and four manifests. Retrieval selects relevant teaching text for Gemini; worksheet downloads come from the approved PDFs. The original student-work and organisation-record folders were excluded.

## Using the app

Sign in, create/select a fictional student, upload a small JPG, PNG, or PDF, wait for analysis, review the flagged words, then generate recommendations and download a worksheet. Existing samples uploaded on Windows may refer to laptop-only paths; upload a new cloud sample for the demo.

The website and login page are public. Student APIs and scan/PDF downloads require login. This demo currently shares student access among signed-in accounts, so use fictional hackathon data.

## Updating teaching resources later

Rebuild the approved package with the Desktop `Rebuild-Knowledge-LexiPath.cmd` shortcut, then open PowerShell and run:

```powershell
. 'C:\Users\somes\Desktop\LexiPath\outputs\Google-Cloud-Environment.ps1'
Set-Location 'C:\Users\somes\Desktop\LexiPath\project'
.\scripts\upload-knowledge.ps1 -ProjectId lexihacks
```

This uploads the generated teaching bundle only. If Cloud Storage's mounted-file cache has not refreshed yet, create a new Cloud Run revision by updating a harmless revision marker.

## Cloud deployment versus the prepared setup script

The existing service and private buckets were reused. Recommendations were switched from mocks to live Gemini, and the approved teaching package was uploaded. The existing secrets and email settings were preserved. No new database or account password was created.

The existing deployment has working Atlas access without the static-NAT network described in `GOOGLE_CLOUD.md`. That guide's setup script describes a separate, fuller infrastructure configuration; do not run its deployment script against this service until those network prerequisites exist. No NAT gateway was created in this run.

Cloud Run keeps one instance available with CPU allocated for background analysis. The service and storage can incur charges while your laptop is off. Restarting the service during analysis can interrupt a job; there is no durable queue yet.

## Verified on October 2, 2026

Cloud login, student creation, upload, live Gemini analysis, protected scan retrieval, educator review, live RAG recommendations, teaching-PDF download, saved student reports, and trends passed with temporary fictional data. All synthetic database records and their uploaded scan were removed after verification.

The cloud health endpoint is `/api/health`; `/healthz` remains available locally for compatibility. Both return only database readiness, with no student or account information.

Local verification of the readiness change: focused tests, server lint, and formatting passed. The full Node 22 server run passed 389 tests, skipped one optional test, and found one existing fuzz-test failure for a blank error-index value. That controller was unchanged in this deployment. Node 24 on this Windows laptop still has the previously observed Atlas DNS issue; the Linux cloud runtime passed the live workflow.
