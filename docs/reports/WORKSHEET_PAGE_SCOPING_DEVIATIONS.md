# Worksheet page-scoping deviations

This file records the only necessary implementation deviation from Phase 7 in
`docs/archive/PLAYWRIGHT_E2E_AND_EVALUATION_EXECUTION_PLAN.md`.

## Private live catalogue override

Phase 7 names `server/data/worksheetSections.json` as the worksheet-section metadata source. That
file exists and is used for deterministic mock-mode coverage. Its committed entries carry
`catalogueMode: "mock"` so they cannot be mistaken for live Azure resources.

Live worksheet IDs are derived at runtime from SHA-256 values in the private Azure asset manifest.
Those IDs and the corresponding page-to-skill review are deployment data, not facts that can be
safely inferred from PDF filenames or invented in source control. Therefore live deployments may
set `WORKSHEET_SECTIONS_PATH` to an ignored, human-reviewed JSON file containing the active Azure
worksheet IDs and approved 2–3-page ranges.

This does not weaken the Phase 7 guardrails:

- every active section is joined to the current approved worksheet catalogue;
- unknown worksheet IDs fail validation;
- ranges must start at page 1 or later and span exactly two or three pages;
- section categories must use the fixed application taxonomy;
- Gemini must copy the exact approved worksheet ID, `pageStart`, and `pageEnd` tuple;
- unknown or altered page ranges are rejected before persistence;
- no configured live sections causes recommendation generation to fail closed rather than return a
  whole-PDF recommendation.

No other Phase 7 behavior is intentionally changed. The client displays the approved range and uses
the PDF viewer’s `#page=` fragment to open at the first recommended page; it does not create or store
a modified copy of the source PDF.
