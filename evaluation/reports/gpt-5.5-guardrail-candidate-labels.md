# GPT-5.5 Guardrail Candidate Labels

**Evaluator:** GPT-5.5 with guardrails
**Review type:** Independent second-round visual evaluation
**Independence note:** I evaluated only the provided sample images/PDF renderings and did not read first-round candidate labels, reports, or corrected/vetted text.

## Guardrails applied

- If unsure whether a word was misspelled or unclear, I used an `illegibleNote`, `unsure`, or lower confidence.
- I preserved the child's apparent written text in `written`; I did not normalize spelling, capitalization, punctuation, or grammar silently.
- For correction labels, `written` and `intended` differ unless the issue is explicitly uncertain.
- I ignored printed worksheet instructions, names/dates where irrelevant, teacher-style markings, underlines, ticks/crosses, and comments.
- I did not guess illegible words; unclear spans are marked as `[illegible]`/`[unclear]` or discussed as low-confidence.
- I used only these categories: `phonological`, `orthographic`, `morphological`, `capitalisation`, `punctuation`, `unsure`.

---

## Sample: writing-16127

- **Source:** `samples/Narrative Writing/Narrative Writing/Writing_16127.jpg`
- **Task type:** Narrative Writing
- **Candidate file:** `evaluation/ground-truth-candidates/gpt55-guardrail-writing-16127.candidate.json`

### Approximate transcript

```text
one Day I was runing back home becaue I need to go pee! so
I was So achen that I pee in my pant back home, So I call my
mom on my phone nd say I pee on my pant She say hurry come back
home! so I hid and I run back home and washe myslft up before going slip.
```

Uncertain spans: `achen`, `nd`, `myslft`, and the ending phrase `going slip` are low-confidence because the scan is angled and several words overlap ruled lines or marks.

### Candidate error table

| ID | Written | Intended | Category | Confidence | Notes |
|---|---|---|---|---:|---|
| writing-16127-e01 | Day | day | capitalisation | 0.72 | Capitalized common noun in `one Day`. |
| writing-16127-e02 | runing | running | orthographic | 0.76 | Missing doubled consonant. |
| writing-16127-e03 | becaue | because | orthographic | 0.80 | Appears to omit `s`. |
| writing-16127-e04 | need | needed | morphological | 0.58 | Past-tense narrative; grammar judgment kept lower-confidence. |
| writing-16127-e05 | So | so | capitalisation | 0.55 | Mid-sentence capitalization; punctuation boundary unclear. |
| writing-16127-e06 | achen | aching | unsure | 0.42 | Unclear word; possible spelling of `aching`. |
| writing-16127-e07 | pant | pants | morphological | 0.77 | Missing final/plural `s`. |
| writing-16127-e08 | call | called | morphological | 0.57 | Past-tense narrative; lower-confidence grammar/tense label. |
| writing-16127-e09 | nd | and | orthographic | 0.61 | Appears to omit initial `a`. |
| writing-16127-e10 | say | said | morphological | 0.58 | Past-tense narrative; lower-confidence grammar/tense label. |
| writing-16127-e11 | pant | pants | morphological | 0.72 | Second likely missing final/plural `s`. |
| writing-16127-e12 | She say | She said | morphological | 0.56 | Past-tense phrase; constrained category. |
| writing-16127-e13 | washe | washed | morphological | 0.62 | Likely missing final past-tense consonant. |
| writing-16127-e14 | myslft | myself | orthographic | 0.48 | Low-confidence spelling/letter reading. |
| writing-16127-e15 | slip | sleep | phonological | 0.51 | Possible vowel substitution in final word; low confidence. |

### Category summary

| Category | Count |
|---|---:|
| capitalisation | 2 |
| orthographic | 4 |
| morphological | 7 |
| phonological | 1 |
| unsure | 1 |

### Guardrail notes

The narrative contains many possible grammar/tense corrections. I only labeled the clearer repeated tense/plural cases and kept confidence modest. I did not turn the whole passage into a polished transcript; unclear forms remain in `written`.

---

## Sample: student-191379

- **Source:** `samples/Edit&Diagram 1/Edit&Diagram 1/Student-191379.jpg`
- **Task type:** Edit&Diagram 1
- **Candidate file:** `evaluation/ground-truth-candidates/gpt55-guardrail-student-191379.candidate.json`

### Approximate transcript

```text
He run
The fox hunt
I sang
Pam swims in water
Tom Hops
```

Uncertain spans: none, though the `H` in `Hops` could be interpreted as an oversized lowercase `h`; therefore that capitalization label is below high confidence.

### Candidate error table

| ID | Written | Intended | Category | Confidence | Notes |
|---|---|---|---|---:|---|
| student-191379-e01 | He run | He runs | morphological | 0.88 | Third-person singular verb ending. |
| student-191379-e02 | The fox hunt | The fox hunts | morphological | 0.86 | Singular subject needs verb ending. |
| student-191379-e03 | Hops | hops | capitalisation | 0.68 | Apparent capitalized verb after proper noun. |

### Category summary

| Category | Count |
|---|---:|
| morphological | 2 |
| capitalisation | 1 |

### Guardrail notes

I did not label `Pam swims in water` because it is odd but not clearly wrong without normalizing grammar beyond the fixed categories.

---

## Sample: student-92398

- **Source:** `samples/Edit&Diagram 3/Edit&Diagram 3/Student-92398.pdf`
- **Task type:** Edit&Diagram 3
- **Candidate file:** `evaluation/ground-truth-candidates/gpt55-guardrail-student-92398.candidate.json`

### Approximate transcript

```text
John took a nap in his room.
Birds can fly because they have wings and light bones.
We planned to visit her in the morning.
The girl set [illegible/unclear mark] on the bed in the room.
Peter ran as fast as he could [unclear extra marks] from cats
```

Uncertain spans: the fourth line has an unclear/crossed span after `set`; the fifth line has unclear marks between `could` and `from`. These are intentionally marked low-confidence.

### Candidate error table

| ID | Written | Intended | Category | Confidence | Notes |
|---|---|---|---|---:|---|
| student-92398-e01 | set | sat | orthographic | 0.66 | Likely vowel substitution in `The girl set ... on the bed`; nearby marks make it candidate-only. |
| student-92398-e02 | could [unclear] from cats | could away from cats | unsure | 0.34 | Possible intended phrase, but unclear enough to avoid confident grammar classification. |

### Category summary

| Category | Count |
|---|---:|
| orthographic | 1 |
| unsure | 1 |

### Guardrail notes

Most lines appear clean. I avoided labeling possible phrase-level grammar issues unless there was a visible handwritten cue; the final-line phrase remains `unsure` with low confidence.

---

## Overall category summary

| Category | Count |
|---|---:|
| capitalisation | 3 |
| orthographic | 5 |
| morphological | 9 |
| phonological | 1 |
| unsure | 2 |
| punctuation | 0 |

## Files produced

- `evaluation/ground-truth-candidates/gpt55-guardrail-writing-16127.candidate.json`
- `evaluation/ground-truth-candidates/gpt55-guardrail-student-191379.candidate.json`
- `evaluation/ground-truth-candidates/gpt55-guardrail-student-92398.candidate.json`
- `evaluation/reports/gpt-5.5-guardrail-candidate-labels.md`
