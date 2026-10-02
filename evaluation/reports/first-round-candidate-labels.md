# First-round AI error findings for human vetting

Evaluator: GPT-5.5 visual review through Hermes Agent  
Date: 2026-08-11  
Status: Candidate labels only — not ground truth until human-vetted.

## How to vet

For each row, fill the `Human verdict` column in your copy/review notes:

- `accept` — keep as ground truth.
- `edit` — keep but change written/intended/category/rationale/location.
- `reject` — remove from ground truth.
- `add` — add any missed error not listed here.

After vetting, copy corrected JSON files from:

```text
evaluation/ground-truth-candidates/
```

to:

```text
evaluation/ground-truth-vetted/
```

and change `reviewStatus` from `candidate` to `vetted`.

## Sample transcripts used for first pass

### writing-16127

Approximate transcript, uncertain words preserved/flagged:

> one Day I was runing back home be cause I need to go pee so  
> I was so abchen that I pee on my pant back home, so I call my  
> mom on my phone and say I my mom my pant she say hurry come back  
> home, so I Hid and I run back home and wash myslef up befor going sleep

transcript errors:
- student writes bay instead of Day. AI confused with teacher red marking
- because instead of be cause
- phoep instead of phone
- "bay I pee no my pant She say hurry come back home!" instead of "and say I my mom my pant she say hurry come back"
> home," by the ai
- "before" instead of "befor" , interpreted wrongly likely due to big spacing.

### student-191379

> He run  
> The fox hunt  
> I sang  
> Pam swims in water  
> Tom Hoops

transcript errors:
- Hops instead of Hoops

### student-92398

> John took a nap in his room.  
> Birds can fly because they have wings and light bones.  
> We planned to visit her in the morning.  
> The girl sat on the bed in the room.  
> Peter ran as fast as he could from cats

transcript errors:
No error

## Candidate error table

| ID | Sample | Written text | Intended text | Category | Confidence | Rationale | Human verdict |
|---|---|---|---|---|---:|---|---|
| writing-16127-e001 | writing-16127 | Day | day | capitalisation | 0.80 | Word appears mid-sentence after `one` but is capitalised. | transcription error, its actually a spelling error for "bay" |
| writing-16127-e002 | writing-16127 | runing | running | orthographic | 0.85 | Missing doubled consonant in `running`. | good |
| writing-16127-e003 | writing-16127 | be cause | because | orthographic | 0.85 | Compound word is split into two words. | transcription error, false positive |
| writing-16127-e004 | writing-16127 | need | needed | morphological | 0.65 | Past-tense narrative context likely requires `-ed`. | good |
| writing-16127-e005 | writing-16127 | abchen | anxious | unsure | 0.35 | Teacher-underlined and likely intended as `anxious`, but handwriting is uncertain. | good |
| writing-16127-e006 | writing-16127 | pee | peed | morphological | 0.60 | Past-tense event likely needs `-ed`. | need to go pee! is correct |
| writing-16127-e007 | writing-16127 | pant | pants | morphological | 0.75 | Plural noun form is expected. | good |
| writing-16127-e008 | writing-16127 | call | called | morphological | 0.75 | Past-tense narrative context likely requires `-ed`. | good |
| writing-16127-e009 | writing-16127 | say | said | morphological | 0.65 | Past-tense speech reporting should use `said`. | good |
| writing-16127-e010 | writing-16127 | Hid | hid | capitalisation | 0.70 | Word appears mid-sentence but is capitalised. | bad transcription, hallucinated error |
| writing-16127-e011 | writing-16127 | run | ran | morphological | 0.80 | Past tense of `run` should be `ran`. | good |
| writing-16127-e012 | writing-16127 | wash | washed | morphological | 0.75 | Past-tense narrative context likely requires `-ed`. | good |
| writing-16127-e013 | writing-16127 | myslef | myself | orthographic | 0.75 | Letters appear transposed in `myself`. | good |
| writing-16127-e014 | writing-16127 | befor | before | orthographic | 0.70 | Final `e` appears omitted from `before`. | bad transcription, hallucinated error |
| writing-16127-e015 | writing-16127 | going sleep | going to sleep | unsure | 0.45 | Likely missing function word `to`; phrase-level grammar issue rather than single-word spelling. | good |
| student-191379-e001 | student-191379 | He run | He runs | morphological | 0.85 | Third-person singular present-tense verb likely requires `-s`. | good |
| student-191379-e002 | student-191379 | The fox hunt | The fox hunts | morphological | 0.80 | Third-person singular subject likely requires present-tense `-s`. | good |
| student-191379-e003 | student-191379 | Hoops | hops | orthographic | 0.70 | Likely intended verb is `hops`; written form has an extra `o` and capital H mid-line. | bad transcription, hallucinated error |
| student-92398-e001 | student-92398 | cats | cats. | punctuation | 0.55 | Final sentence appears to end without a full stop; confirm whether punctuation was expected. | good |

## AI-missed error
Capitalisation of "one" (Sentence Opening): The very first word of the passage, one, is written in lower case at the start of the sentence (one Day ...).

Missing word / Grammar error ("and say I my mom"): In line 3, the handwritten text reads ... phone and say I peed my pant ... (or say I pee...), but the AI agent completely skipped flagging the missing preposition to (should be say to my mom) or the missing word that.

on my pant
in my pants
lexical / preposition
0.80
You normally say peed in my pants, not "on my pants." Agent caught pant → pants but not on → in.

Capitalisation of "She": In line 3, She is capitalized mid-sentence (... pant She say ...).

Punctuation & Sentence Splice (Exclamation Mark): In line 3/4, there is an exclamation mark after home! (hurry come back home!). The AI agent missed flagging missing terminal punctuation across the rest of the text.

Insertion of "and" / Transcription gap: Between hid and I run back home, the teacher/corrector added the insertion symbol ^ and wrote and above it (so I hid and I run back home). The original student text omitted this conjunction.

Capitalisation of "So" / "I": Multiple occurrences of mid-sentence capitalization (e.g., so I where I is lowercase or So is capitalized mid-clause) were not flagged by the agent.

second say
said
morphological
0.90
There are apparently two say occurrences: "and say..." and "she say...". Your agent only generated one row.

...pant she say...
...pants. She said...
sentence structure / punctuation
0.90
This is a run-on sentence. The teacher's margin annotation also appears to flag sentence structure.

Line 1
pee! so
pee! So
capitalisation
0.80
If ! ends the sentence, so should begin with a capital.

## Category summary before vetting

| Category | Candidate count |
|---|---:|
| capitalisation | 2 |
| orthographic | 5 |
| morphological | 9 |
| punctuation | 1 |
| unsure | 2 |
| phonological | 0 |

## Notes for metric calculation after vetting

After you vet these labels, we can run GPT-5.5/model-output evaluation against the vetted files and calculate:

| Metric group | Metrics |
|---|---|
| Detection | TP, FP, FN, precision, recall, F1 |
| Classification | category accuracy, per-category confusion counts |
| Speed | latency per sample, average latency, p95 if multiple runs exist |
| Recommendation system | evidence faithfulness, target-category relevance, worksheet/page-range usefulness, hallucinated resource rate |

The candidate files created in this pass are:

```text
evaluation/ground-truth-candidates/writing-16127.candidate.json
evaluation/ground-truth-candidates/student-191379.candidate.json
evaluation/ground-truth-candidates/student-92398.candidate.json
```
