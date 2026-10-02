# Retrieval robustness pilot

This pilot evaluates the current lexical knowledge ranker with four skill families and four natural-language query forms per family.

The evaluator-only acceptable resource IDs are stored in `pilot-families.json`. The system receives only each query's `input` from `pilot-queries.json`; expected resource IDs and KnowledgeVault metadata are never passed to the ranker.

Run from the repository root:

```bash
node --test evaluation/test/retrievalPilot.test.mjs
KNOWLEDGE_VAULT_PATH="$HOME/KnowledgeVault" node evaluation/scripts/run-retrieval-pilot.mjs
```

Reported metrics are deliberately limited to:

- Top-1 family hit
- Top-3 family hit
- number of families for which all four variants succeed at Top 3
- per-query failure reason

Results are written to `pilot-results.json` and `pilot-results.md`.
