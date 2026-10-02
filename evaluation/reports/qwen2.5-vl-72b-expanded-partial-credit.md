# Qwen 2.5 VL 72B — expanded vetted evaluation

Date: 2026-08-12

## Run contract

- Provider: OpenRouter
- Model: `qwen/qwen2.5-vl-72b-instruct`
- Samples: 11/11 completed
- Vetted errors: 73
- Pipeline: raw direct vision
- Guardrail profile: `none`
- Temperature: 0
- Maximum output: 4096 tokens
- Automatic retries: none
- Prediction directory: `evaluation/predictions/qwen2.5-vl-72b-expanded-vetted-20260812/`

The truth and prediction directories contained the same 11 sample IDs. Every artifact reported the expected provider, model, pipeline, and guardrail profile.

The PDF renderer emitted non-fatal JPEG/JBig2/CCITT decoder warnings on some files. All 11 samples nevertheless produced valid prediction artifacts; no provider or artifact failure occurred.

## Scoring policy

Three views are retained:

1. **Strict:** exact normalized `written` and `intended` pair.
2. **Bounded lenient:** full credit when category is correct and whole-word correction spans are exact or nested equivalents.
3. **Recognition partial credit (primary):**
   - 1.0 point for a bounded-lenient category-aware match;
   - 0.5 point when the prediction identifies and actually changes the same or nested written span but gives a different plausible correction or category;
   - 0 points when the relevant word merely occurs inside a longer correction but is left unchanged.

Partial matches are one-to-one. A half-credit match contributes 0.5 weighted TP, 0.5 weighted FP, and 0.5 weighted FN. This keeps precision and recall denominators equal to prediction count and vetted-error count respectively. Vetted truth was not changed during scoring.

## Aggregate results

| Scoring mode | TP / weighted TP | FP / weighted FP | FN / weighted FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Strict | 7 | 51 | 66 | 0.121 | 0.096 | 0.107 |
| Bounded lenient | 17 | 41 | 56 | 0.293 | 0.233 | 0.260 |
| Recognition partial credit | 18.5 | 39.5 | 54.5 | 0.319 | 0.253 | **0.282** |

Primary partial-credit matching contained 17 full matches and 3 half-credit matches. Average latency was 18.9 seconds across 11 samples.

## Sample-type analysis

| Sample group | Samples | Truth errors | Predictions | Full | Half | Precision | Recall | F1 | Avg latency |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Long narrative | 3 | 60 | 33 | 10 | 2 | 0.333 | 0.183 | 0.237 | 40.1s |
| Short edit/diagram | 8 | 13 | 25 | 7 | 1 | 0.300 | 0.577 | **0.395** | 10.9s |
| Known messy handwriting (`writing-16127`) | 1 | 19 | 9 | 3 | 1 | 0.389 | 0.184 | 0.250 | 45.9s |
| Other long narratives (legibility not reviewer-tagged) | 2 | 41 | 24 | 7 | 1 | 0.313 | 0.183 | 0.231 | 37.1s |
| Original established set | 3 | 22 | 14 | 5 | 1 | 0.393 | 0.250 | 0.306 | 22.6s |
| Vetted expansion | 8 | 51 | 44 | 12 | 2 | 0.295 | 0.255 | 0.274 | 17.5s |

The strongest observable difference is response format/length: short edit-and-diagram samples had much higher recall and F1 than long narratives. The single known messy sample cannot isolate handwriting quality from long-text difficulty because it is also a long narrative.

## Per-sample partial-credit results

| Sample | Truth | Predicted | Full | Half | Precision | Recall | F1 | Latency |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| student-121606 | 5 | 4 | 2 | 1 | 0.625 | 0.500 | 0.556 | 13.6s |
| student-191379 | 2 | 3 | 2 | 0 | 0.667 | 1.000 | **0.800** | 15.9s |
| student-284857 | 2 | 5 | 1 | 0 | 0.200 | 0.500 | 0.286 | 16.7s |
| student-390968 | 1 | 1 | 1 | 0 | 1.000 | 1.000 | **1.000** | 5.0s |
| student-82935 | 1 | 3 | 0 | 0 | 0.000 | 0.000 | 0.000 | 14.1s |
| student-89037 | 0 | 5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 9.0s |
| student-92398 | 1 | 2 | 0 | 0 | 0.000 | 0.000 | 0.000 | 5.8s |
| student-94156 | 1 | 2 | 1 | 0 | 0.500 | 1.000 | 0.667 | 7.3s |
| writing-16083 | 17 | 14 | 4 | 1 | 0.321 | 0.265 | 0.290 | 41.5s |
| writing-16115 | 24 | 10 | 3 | 0 | 0.300 | 0.125 | 0.176 | 32.8s |
| writing-16127 | 19 | 9 | 3 | 1 | 0.389 | 0.184 | 0.250 | 45.9s |

## Half-credit matches

The three awarded half-credit matches were:

1. `Pam Swimming?` — vetted `Pam swims.`; predicted `Pam is swimming?` in the same morphological category.
2. `Your` → `You're` — Qwen corrected the phrase as `your not mad?` → `you're not mad?` but used a different category.
3. `call` → `called` — Qwen corrected the containing sentence while combining that change with a spelling correction and assigning a different category.

Two initially tempting overlaps were deliberately rejected: the model left `cats` unchanged while correcting another part of its sentence, and left `wash` unchanged while rewriting text after it. This prevents the 0.5 rule from rewarding incidental word overlap.

## Interpretation

- Qwen is substantially better on short edit/diagram responses than on long narratives.
- Recall is the main weakness on long writing: it found only 11 weighted points out of 60 vetted errors.
- It over-corrected the true-negative `student-89037`, proposing five errors where the vetted truth contains none.
- Partial credit improves aggregate F1 from 0.260 to 0.282, but does not change the overall conclusion that performance is uneven and weak on long-form handwriting.
- The expanded result is more reliable than the earlier three-sample pilot, but handwriting, length, and task format are still partially confounded.
