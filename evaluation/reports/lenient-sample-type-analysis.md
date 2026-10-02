# Lenient category-aware model evaluation by sample type

This pilot rerun uses the same raw-image, no-guardrail pipeline for all models. A prediction counts as a true positive only when its category matches the ground truth and its `written` and `intended` spans are either exact or one is a whole-word subspan of the other. This credits equivalent localisation such as `run` → `runs` versus `He run` → `He runs`, but does not credit unrelated text, fuzzy transcription guesses, or the correct correction with the wrong category.

## Overall rerun

| Model | TP | FP | FN | Precision | Recall | F1 | Strict F1 | Avg latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini Flash | 11 | 6 | 11 | 0.647 | 0.500 | 0.564 | 0.410 | 9.031s |
| Qwen 2.5 VL 72B | 3 | 12 | 19 | 0.200 | 0.136 | 0.162 | 0.054 | 11.988s |
| Cloudflare Llama 3.2 Vision | 0 | 12 | 22 | 0.000 | 0.000 | 0.000 | 0.000 | 12.635s |

## Per-sample results

| Model | Sample | Handwriting | Length | Format | GT | Predicted | TP | FP | FN | F1 | Latency |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini Flash | writing-16127 | messy | long | narrative | 19 | 13 | 9 | 4 | 10 | 0.563 | 13.409s |
| Gemini Flash | student-191379 | neat | short | edit-and-diagram | 2 | 3 | 2 | 1 | 0 | 0.800 | 6.718s |
| Gemini Flash | student-92398 | neat | short | edit-and-diagram | 1 | 1 | 0 | 1 | 1 | 0.000 | 6.967s |
| Qwen 2.5 VL 72B | writing-16127 | messy | long | narrative | 19 | 10 | 1 | 9 | 18 | 0.069 | 21.635s |
| Qwen 2.5 VL 72B | student-191379 | neat | short | edit-and-diagram | 2 | 3 | 2 | 1 | 0 | 0.800 | 6.677s |
| Qwen 2.5 VL 72B | student-92398 | neat | short | edit-and-diagram | 1 | 2 | 0 | 2 | 1 | 0.000 | 7.652s |
| Cloudflare Llama 3.2 Vision | writing-16127 | messy | long | narrative | 19 | 8 | 0 | 8 | 19 | 0.000 | 19.338s |
| Cloudflare Llama 3.2 Vision | student-191379 | neat | short | edit-and-diagram | 2 | 2 | 0 | 2 | 2 | 0.000 | 8.634s |
| Cloudflare Llama 3.2 Vision | student-92398 | neat | short | edit-and-diagram | 1 | 2 | 0 | 2 | 1 | 0.000 | 9.933s |

## Handwriting

| Model | Group | Samples | TP | FP | FN | Precision | Recall | F1 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini Flash | messy | 1 | 9 | 4 | 10 | 0.692 | 0.474 | 0.563 |
| Gemini Flash | neat | 2 | 2 | 2 | 1 | 0.500 | 0.667 | 0.571 |
| Qwen 2.5 VL 72B | messy | 1 | 1 | 9 | 18 | 0.100 | 0.053 | 0.069 |
| Qwen 2.5 VL 72B | neat | 2 | 2 | 3 | 1 | 0.400 | 0.667 | 0.500 |
| Cloudflare Llama 3.2 Vision | messy | 1 | 0 | 8 | 19 | 0.000 | 0.000 | 0.000 |
| Cloudflare Llama 3.2 Vision | neat | 2 | 0 | 4 | 3 | 0.000 | 0.000 | 0.000 |

## Text length

| Model | Group | Samples | TP | FP | FN | Precision | Recall | F1 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini Flash | long | 1 | 9 | 4 | 10 | 0.692 | 0.474 | 0.563 |
| Gemini Flash | short | 2 | 2 | 2 | 1 | 0.500 | 0.667 | 0.571 |
| Qwen 2.5 VL 72B | long | 1 | 1 | 9 | 18 | 0.100 | 0.053 | 0.069 |
| Qwen 2.5 VL 72B | short | 2 | 2 | 3 | 1 | 0.400 | 0.667 | 0.500 |
| Cloudflare Llama 3.2 Vision | long | 1 | 0 | 8 | 19 | 0.000 | 0.000 | 0.000 |
| Cloudflare Llama 3.2 Vision | short | 2 | 0 | 4 | 3 | 0.000 | 0.000 | 0.000 |

## Sample format

| Model | Group | Samples | TP | FP | FN | Precision | Recall | F1 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gemini Flash | narrative | 1 | 9 | 4 | 10 | 0.692 | 0.474 | 0.563 |
| Gemini Flash | edit-and-diagram | 2 | 2 | 2 | 1 | 0.500 | 0.667 | 0.571 |
| Qwen 2.5 VL 72B | narrative | 1 | 1 | 9 | 18 | 0.100 | 0.053 | 0.069 |
| Qwen 2.5 VL 72B | edit-and-diagram | 2 | 2 | 3 | 1 | 0.400 | 0.667 | 0.500 |
| Cloudflare Llama 3.2 Vision | narrative | 1 | 0 | 8 | 19 | 0.000 | 0.000 | 0.000 |
| Cloudflare Llama 3.2 Vision | edit-and-diagram | 2 | 0 | 4 | 3 | 0.000 | 0.000 | 0.000 |

## Interpretation limits

- This is a three-sample pilot: one messy/long narrative and two neat/short edit-and-diagram samples. The dimensions overlap, so differences cannot be attributed causally to handwriting, length, or format.
- Each provider was run once per sample; latency and model outputs can vary between runs.
- The matcher is deliberately bounded and deterministic. It is more lenient about span boundaries, not spelling similarity, and still requires the exact category.
- Ground truth contains 22 errors in total, with 19 concentrated in the messy narrative sample.
