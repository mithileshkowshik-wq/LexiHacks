# Controlled pipeline selection

All rows use the same three samples and 22 human-vetted errors. Scoring uses strict,
case-insensitive exact matching on `written` and `intended`. Each inference run was completed before
the post-run scorer read ground truth.

## Gemini pipeline candidates

| Candidate | Input        | Guardrail profile |  TP |  FP |  FN | Precision | Recall |    F1 | Avg latency (ms) |
| --------: | ------------ | ----------------- | --: | --: | --: | --------: | -----: | ----: | ---------------: |
|         1 | Raw          | None              |  11 |   9 |  11 |     0.550 |  0.500 | 0.524 |        11643.333 |
|         2 | Preprocessed | None              |  10 |   9 |  12 |     0.526 |  0.455 | 0.488 |        25068.000 |
|         3 | Preprocessed | Minimal           |   8 |  10 |  14 |     0.444 |  0.364 | 0.400 |        13583.000 |

## Selected pipeline

**Raw image with no guardrail** is selected. It had the highest F1 and the lowest average latency of
the three controlled Gemini candidates. On this pilot, preprocessing and the minimal guardrail did
not improve Gemini under the strict scorer.

## Same-pipeline cross-model comparison

| Model                       | Input | Guardrail profile |  TP |  FP |  FN | Precision | Recall |    F1 | Avg latency (ms) | Status   |
| --------------------------- | ----- | ----------------- | --: | --: | --: | --------: | -----: | ----: | ---------------: | -------- |
| Gemini Flash                | Raw   | None              |  11 |   9 |  11 |     0.550 |  0.500 | 0.524 |        11643.333 | Complete |
| Qwen 2.5 VL 72B             | Raw   | None              |   2 |  14 |  20 |     0.125 |  0.091 | 0.105 |        24239.000 | Complete |
| Cloudflare Llama 3.2 Vision | Raw   | None              |   0 |  12 |  22 |     0.000 |  0.000 | 0.000 |        14068.667 | Complete |

## Interpretation limits

- This is a three-sample pilot, not a population estimate.
- Provider latency is variable and was measured from one run per sample.
- Strict text matching penalises transcription differences even when approximate locations agree.
- The unavailable OpenRouter Qwen 2.5 VL 7B free endpoint was not silently substituted; the live
  comparison records the available `qwen/qwen2.5-vl-72b-instruct` model explicitly.
