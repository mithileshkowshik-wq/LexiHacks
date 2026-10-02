# Gemini DAS benchmark — expanded vetted set

Date: 2026-08-12

## Dataset and scoring

- Vetted samples: 11
- Vetted errors: 73
- Pipeline: raw/direct vision
- Guardrail profile: `none`
- Scoring views:
  - **Strict**: exact normalized `written` + `intended`.
  - **Bounded lenient**: whole-word/nested correction spans with correct category.
  - **Recognition partial credit**: 1.0 for bounded-lenient matches; 0.5 when the same written span is correctly noticed but the correction/category differs.

The primary score below is the recognition partial-credit score because it matches the requested more lenient judging style.

## Headline results

| Model/run | Completed | Full matches | Half matches | Weighted TP | Weighted FP | Weighted FN | Precision | Recall | F1 | Avg latency |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Gemini Flash/free (`gemini-flash-latest`) | 11/11 | 42 | 5 | 44.5 | 29.5 | 28.5 | 0.601 | 0.610 | **0.605** | 11.5s |
| Qwen 2.5 VL 72B | 11/11 | 17 | 3 | 18.5 | 39.5 | 54.5 | 0.319 | 0.253 | 0.282 | 18.9s |
| Gemini Pro (`gemini-pro-latest`) | 4/11 only | 4 | 5 | 6.5 | 17.5 | — | 0.271 | — | — | 24.6s |

Important: Gemini Pro is **not a complete benchmark**. It completed four samples and then repeatedly timed out on `student-82935`, including after increasing the Gemini request timeout. I am reporting its completed artifacts only, not presenting a full-dataset F1.

## Gemini Flash/free scoring views

| Scoring mode | TP / weighted TP | FP / weighted FP | FN / weighted FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Strict | 36 | 38 | 37 | 0.486 | 0.493 | 0.490 |
| Bounded lenient | 43 | 31 | 30 | 0.581 | 0.589 | 0.585 |
| Recognition partial credit | 44.5 | 29.5 | 28.5 | 0.601 | 0.610 | **0.605** |

The partial-credit view adds five half-credit matches beyond the full matches. This is the prettier and more useful result: it credits cases where Gemini noticed the right problematic span but did not exactly match the vetted category/correction.

## Gemini Flash/free by sample type

| Group | Samples | Truth errors | Predictions | Full | Half | Precision | Recall | F1 | Avg latency |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Short edit/diagram | 8 | 13 | 22 | 8 | 4 | 0.455 | 0.769 | 0.571 | 8.8s |
| Long narrative | 3 | 60 | 52 | 34 | 1 | 0.663 | 0.575 | **0.616** | 18.7s |
| Known messy handwriting (`writing-16127`) | 1 | 19 | 10 | 8 | 0 | 0.800 | 0.421 | 0.552 | 14.1s |

Observation: Gemini Flash/free is now clearly ahead of Qwen on this benchmark. Unlike Qwen, it does not collapse on the long narratives; its long-narrative F1 is slightly higher than its edit/diagram F1 because precision is much better there. The messy sample is still recall-limited but much stronger than Qwen.

## Gemini Flash/free per-sample results

| Sample | Type | Truth | Predicted | Full | Half | Precision | Recall | F1 | Latency |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `student-121606` | edit/diagram | 5 | 6 | 1 | 3 | 0.417 | 0.500 | 0.455 | 12.9s |
| `student-191379` | edit/diagram | 2 | 3 | 2 | 0 | 0.667 | 1.000 | 0.800 | 6.4s |
| `student-284857` | edit/diagram | 2 | 4 | 2 | 0 | 0.500 | 1.000 | 0.667 | 7.3s |
| `student-390968` | edit/diagram | 1 | 1 | 1 | 0 | 1.000 | 1.000 | 1.000 | 9.2s |
| `student-82935` | edit/diagram | 1 | 2 | 0 | 1 | 0.250 | 0.500 | 0.333 | 8.0s |
| `student-89037` | edit/diagram true-negative | 0 | 1 | 0 | 0 | 0.000 | 0.000 | 0.000 | 7.8s |
| `student-92398` | edit/diagram | 1 | 2 | 1 | 0 | 0.500 | 1.000 | 0.667 | 7.9s |
| `student-94156` | edit/diagram | 1 | 3 | 1 | 0 | 0.333 | 1.000 | 0.500 | 10.7s |
| `writing-16083` | long narrative | 17 | 16 | 13 | 0 | 0.813 | 0.765 | 0.788 | 17.4s |
| `writing-16115` | long narrative | 24 | 26 | 13 | 1 | 0.519 | 0.563 | 0.540 | 24.5s |
| `writing-16127` | messy long narrative | 19 | 10 | 8 | 0 | 0.800 | 0.421 | 0.552 | 14.1s |

## Gemini Pro partial run

Gemini Pro completed only:

- `student-121606`
- `student-191379`
- `student-284857`
- `student-390968`

Then it timed out on `student-82935` twice:

1. `DOMException [TimeoutError]` at the original 120s request timeout.
2. `HeadersTimeoutError: UND_ERR_HEADERS_TIMEOUT` after extending the Gemini abort timeout.

Completed-sample-only partial-credit totals:

| Completed subset | Samples | Truth errors in completed subset | Predictions | Full | Half | Weighted TP | Weighted FP | Weighted FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Gemini Pro completed artifacts | 4 | 10 | 24 | 4 | 5 | 6.5 | 17.5 | 3.5 | 0.271 | 0.650 | 0.382 |

This subset is too small and biased toward edit/diagram samples, so it should not be compared directly with the 11/11 Flash or Qwen results.

## Interpretation

1. **Gemini Flash/free is currently the best completed model run.** Its partial-credit F1 is 0.605 versus Qwen's 0.282.
2. **The new lenient scoring materially improves interpretability.** Flash strict F1 is 0.490, bounded lenient is 0.585, and partial-credit is 0.605.
3. **Long-form performance is surprisingly strong for Flash.** The best sample is `writing-16083` at F1 0.788.
4. **True-negative handling still needs work.** `student-89037` has no vetted errors but Gemini still predicted one error.
5. **Gemini Pro is blocked by stability/timeouts, not scoring.** It produced artifacts for four samples but could not finish the benchmark.

## Artifacts

- Flash/free predictions: `evaluation/predictions/gemini-flash-latest-das-free-vetted-20260812/`
- Pro partial predictions: `evaluation/predictions/gemini-pro-latest-das-vetted-20260812/`
- Report: `evaluation/reports/gemini-das-expanded-partial-credit.md`
