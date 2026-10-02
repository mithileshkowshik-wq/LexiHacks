# Error detection evaluation for evaluation/predictions/gemini-flash-lite-latest

- Vetted samples: 11
- Missing prediction files: 0
- Failed model predictions: 6
- Missing/failed sample rate: 0.545
- True positives: 12
- False positives: 41
- False negatives: 61
- Detection precision: 0.226
- Detection recall: 0.164
- Detection F1: 0.190
- Classification accuracy on matched errors: 0.833
- Average latency: 10674.091 ms
- P95 latency: 34542.000 ms

## Per-category exact-match metrics

- morphological: precision=0.125, recall=0.045, correct=1, actual=22, predicted=8
- capitalisation: precision=0.200, recall=0.143, correct=1, actual=7, predicted=5
- punctuation: precision=0.000, recall=0.000, correct=0, actual=4, predicted=4
- unsure: precision=0.000, recall=0.000, correct=0, actual=6, predicted=0
- orthographic: precision=0.421, recall=0.242, correct=8, actual=33, predicted=19
- phonological: precision=0.000, recall=0.000, correct=0, actual=1, predicted=17

## Confusion counts

- actual=orthographic, predicted=orthographic: 8
- actual=orthographic, predicted=phonological: 2
- actual=capitalisation, predicted=capitalisation: 1
- actual=morphological, predicted=morphological: 1
