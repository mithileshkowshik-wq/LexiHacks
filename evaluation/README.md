# LexiPath AI evaluation workspace

This directory is for AI accuracy, recommendation-quality, speed, and model-comparison evidence. It is intentionally separate from deterministic CI tests because live model calls can be slow, costly, and non-deterministic.

## Directory layout

```text
evaluation/
  samples/                  # approved or synthetic scans only
  ground-truth-candidates/  # model-generated drafts; not evidence yet
  ground-truth-vetted/      # human-vetted JSON; counts as ground truth
  predictions/              # model outputs grouped by model/pipeline
  reports/                  # generated accuracy/speed summaries
  retrieval/                # knowledge-retrieval pilot inputs/outputs (own README.md)
  lib/                      # shared modules: evaluationMetrics, evaluationPrompt,
                             # modelProviders, retrievalPilot
  test/                     # modelEvaluation.test.mjs, retrievalPilot.test.mjs
  schemas/ground-truth.schema.json
  scripts/validate-ground-truth.mjs
  scripts/evaluate-error-detection.mjs
  scripts/run-model-evaluation.mjs
  scripts/compare-models.mjs
  scripts/generate-model-predictions.mjs
  scripts/analyse-sample-types.mjs
  scripts/run-retrieval-pilot.mjs
  scripts/run-contextual-retrieval-pilot.mjs
  scripts/export-manual-gemini-pilot.mjs
  scripts/score-manual-gemini-pilot.mjs
  scripts/build-manual-gemini-prompts.mjs
  scripts/import-historical-predictions.mjs
  scripts/probe-cloudflare-direct-vision.mjs
```

## Ground-truth rule

Model-generated labels are only candidates. A file becomes ground truth only after a human reviewer checks/corrects it and saves it under `ground-truth-vetted/`.

Do not fake accuracy numbers. If there is not enough vetted data, report the method or a clearly-labelled small pilot.

## Commands

Run from the repository root.

Validate all human-vetted ground-truth JSON files:

```bash
node evaluation/scripts/validate-ground-truth.mjs
```

Evaluate predictions in the default `evaluation/predictions/gemini/` directory against the vetted
ground truth:

```bash
node evaluation/scripts/evaluate-error-detection.mjs
```

Evaluate a specific model or pipeline directory:

```bash
node evaluation/scripts/evaluate-error-detection.mjs evaluation/predictions/<model-or-pipeline>
```

Run an isolated live vision evaluation. The inference runner reads only the sample manifest and
scan files; it never reads `ground-truth-vetted/` or earlier predictions. Copy
`evaluation/.env.example` to the ignored `evaluation/.env` and provide local credentials first.

```bash
node evaluation/scripts/run-model-evaluation.mjs \
  --provider gemini \
  --model gemini-flash-latest \
  --run-id gemini-preprocessed-minimal-guardrail \
  --guardrail-profile minimal

node evaluation/scripts/run-model-evaluation.mjs \
  --provider openrouter \
  --model qwen/qwen-2.5-vl-7b-instruct:free \
  --run-id qwen-2.5-vl-preprocessed-guardrail

node evaluation/scripts/run-model-evaluation.mjs \
  --provider cloudflare \
  --model @cf/meta/llama-3.2-11b-vision-instruct \
  --run-id llama-3.2-vision-preprocessed-guardrail
```

Use `--guardrail-profile none`, `minimal`, or `full` to isolate prompt constraints. The legacy
`--no-guardrails` flag is equivalent to `--guardrail-profile none`. Omit `--no-preprocess` for the
preprocessed pipeline; include it for raw-image controls.

After inference, generate the comparison table. This separate post-run step is the only part that
reads both predictions and human-vetted truth.

```bash
node evaluation/scripts/compare-models.mjs
```

For a lenient, category-aware comparison and breakdown by handwriting, text length, and sample
format, pass the completed run IDs to the stratified scorer:

```bash
node evaluation/scripts/analyse-sample-types.mjs \
  <gemini-run-id> <qwen-run-id> <cloudflare-run-id>
```

This matcher still requires the ground-truth category. It accepts exact correction pairs and
whole-word nested spans, such as `run` → `runs` matching `He run` → `He runs`. It does not use
unbounded fuzzy spelling similarity. The generated report is
`evaluation/reports/lenient-sample-type-analysis.md`.

These scripts are evaluation utilities, not deterministic CI tests. They report meaningful metrics
only when `ground-truth-vetted/` contains human-reviewed labels and the selected predictions
directory contains matching JSON files.

Never paste provider tokens into source, tests, commands, reports, or Git. Credentials disclosed in
chat must be rotated before use. Live-provider calls are opt-in and are not part of CI.

## Error detection/classification metrics

The evaluation scripts are designed to report:

- true positives, false positives, false negatives
- detection precision, recall, and F1
- classification accuracy on matched errors
- per-category confusion counts
- model latency when predictions include `latencyMs`

## Prediction format

Prediction files should follow the same top-level shape as ground truth and may include:

```json
{
  "sampleId": "sample-001",
  "model": "gemini-2.0-flash",
  "pipeline": "direct-vision",
  "latencyMs": 1420,
  "errors": []
}
```

## Generate live Gemini predictions

Load the API key from `server/.env` without printing it and name each model explicitly:

```bash
node --env-file=server/.env evaluation/scripts/generate-model-predictions.mjs \
  gemini-flash-lite-latest gemini-flash-latest gemini-pro-latest
```

The generator mirrors the production upload path by rendering every PDF into one PNG per page before inference. Predictions are written to `evaluation/predictions/<model>/`. Useful optional controls are:

- `BENCHMARK_SAMPLE_IDS=sample-a,sample-b` — run only selected vetted samples.
- `BENCHMARK_RETRY_FAILED_ONLY=true` — preserve successful predictions and retry failures.
- `BENCHMARK_DELAY_MS=2000` — delay between requests to reduce quota pressure.

Evaluate one generated model directory with:

```bash
node evaluation/scripts/evaluate-error-detection.mjs \
  evaluation/predictions/gemini-flash-latest
```

Live model failures remain in the prediction set with `status: "failed"` and count toward false negatives and the reported failure rate. Do not describe a partial or quota-blocked run as a successful model benchmark.

For direct comparison, only compare equivalent pipelines. For example, Gemini direct vision should not be presented as the same architecture as DeepSeek over OCR text unless the report clearly labels it as `ocr-plus-text`.
