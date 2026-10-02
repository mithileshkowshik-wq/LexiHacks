# LexiPath performance smoke tests

This directory contains repeatable mock-mode performance checks for LexiPath's own API paths. These checks use the deterministic E2E API fixture instead of live Gemini, Azure, email, or production MongoDB services.

## Mock-mode smoke test

Run from the repository root:

```bash
node performance/mock-mode-smoke.mjs
```

Optional environment variables:

```bash
LEXIPATH_PERF_ITERATIONS=50 LEXIPATH_PERF_CONCURRENCY=8 node performance/mock-mode-smoke.mjs
```

The script starts `server/test-support/e2eServer.js`, logs in with the synthetic account, exercises stable authenticated routes, and prints p50/p95/max latency in milliseconds.

This is not a live-AI load test. It is intended to measure application/API responsiveness without third-party latency or quota effects.
