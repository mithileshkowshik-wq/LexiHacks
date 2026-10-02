# Ground-truth expansion: manual vetting packet

Status: **human review complete**. Eight usable samples were promoted to `evaluation/ground-truth-vetted/`; `writing-16145` was excluded as genuinely unreadable.

## Expansion design

- 9 new candidate samples: 3 narrative essays, 3 Edit & Diagram set 1 scans, and 3 Edit & Diagram set 3 scans.
- After all 9 are vetted, the evaluation set will grow from 3 to 12 samples.
- Candidate inference read only the selected scans and task type. It did not read existing ground truth or previous annotations.
- Model labels are a starting point, not evidence. False positives, transcription mistakes, and missed errors are expected.

## Manual vetting workflow

For every candidate row, enter one verdict in the `Human verdict / correction` column:

For this completed review, the reviewer confirmed that a blank verdict means the recognition and label are accepted as written.

- `accept` — the written text, intended text, and category are all correct.
- `edit: ...` — keep the error but state the corrected written/intended/category/rationale.
- `reject: ...` — remove the candidate and briefly state why.
- `add: ...` — record each visible error the model missed.

Then update the corresponding `.candidate.json` file, remove rejected rows, apply edits/additions, change `reviewStatus` to `vetted`, and copy it to `evaluation/ground-truth-vetted/<sampleId>.json`. Do not promote a file until the entire scan—including every PDF page—has been reviewed.

## Review progress

| Sample         | Type         | Source group      | Candidates | Human review complete          |
| -------------- | ------------ | ----------------- | ---------: | ------------------------------ |
| writing-16083  | ESSAY        | Narrative Writing |         15 | [x]                            |
| writing-16115  | ESSAY        | Narrative Writing |         24 | [x]                            |
| writing-16145  | ESSAY        | Narrative Writing |          1 | Excluded: genuinely unreadable |
| student-121606 | SHORT_ANSWER | Edit & Diagram 1  |          4 | [x]                            |
| student-390968 | SHORT_ANSWER | Edit & Diagram 1  |          1 | [x]                            |
| student-89037  | SHORT_ANSWER | Edit & Diagram 1  |          0 | [x]                            |
| student-82935  | SHORT_ANSWER | Edit & Diagram 3  |          1 | [x]                            |
| student-94156  | SHORT_ANSWER | Edit & Diagram 3  |          2 | [x]                            |
| student-284857 | SHORT_ANSWER | Edit & Diagram 3  |          2 | [x]                            |

## writing-16083

- Source: `samples/Narrative Writing/Narrative Writing/Writing_16083.pdf`
- Candidate model: `gemini-flash-latest`
- Candidate latency: 39815 ms
- AI illegibility note: none
- Reviewer sample characteristics: handwriting `[ ] neat  [ ] messy  [ ] mixed`; text `[ ] short  [ ] long`; format `[ ] narrative  [ ] edit/diagram`

| ID                 | Written     | Intended     | Category       | AI confidence | AI rationale                                          | Human verdict / correction |
| ------------------ | ----------- | ------------ | -------------- | ------------: | ----------------------------------------------------- | -------------------------- |
| writing-16083-e001 | studing     | studying     | orthographic   |          0.98 | Misspelled word with missing 'y'.                     |                            |
| writing-16083-e002 | Assesment   | Assessment   | orthographic   |          0.98 | Misspelled word missing double 'ss' in the middle.    |                            |
| writing-16083-e003 | gentel      | gentle       | orthographic   |          0.98 | Misspelled word ending.                               |                            |
| writing-16083-e004 | Asserment   | Assessment   | orthographic   |          0.95 | Misspelled word with 'r' instead of 'ss'.             |                            |
| writing-16083-e005 | tommorrow   | tomorrow     | orthographic   |          0.98 | Misspelled word with extra 'm'.                       |                            |
| writing-16083-e006 | spining     | spinning     | orthographic   |          0.98 | Misspelled word missing double 'n'.                   |                            |
| writing-16083-e007 | i           | I            | capitalisation |          0.99 | Lowercase 'i' used for first-person singular pronoun. |                            |
| writing-16083-e008 | introsive   | intrusive    | orthographic   |          0.98 | Misspelled with 'o' instead of 'u'.                   |                            |
| writing-16083-e009 | serisous    | serious      | orthographic   |          0.98 | Misspelled word with extra 's'.                       |                            |
| writing-16083-e010 | hestant     | hesitant     | orthographic   |          0.98 | Misspelled word missing 'i'.                          |                            |
| writing-16083-e011 | disipline   | discipline   | orthographic   |          0.98 | Misspelled word missing 'c'.                          |                            |
| writing-16083-e012 | wheater     | whether      | orthographic   |          0.95 | Misspelled conjunction 'whether'.                     |                            |
| writing-16083-e013 | disapointed | disappointed | orthographic   |          0.98 | Misspelled word missing second 'p'.                   |                            |
| writing-16083-e014 | servere     | severe       | orthographic   |          0.98 | Misspelled word with extra 'r'.                       |                            |
| writing-16083-e015 | Your        | You're       | orthographic   |          0.98 | Homophone error: 'Your' used instead of 'You're'.     |                            |
| all accepted       |

**Reviewer-added errors missed by AI:**

| Written | Intended | Category | Rationale |
WrittenIntendedCategoryRationalemonthsmonth'spunctuationMissing possessive apostrophe in "months Weighted Assessment".hand werehands weremorphologicalSubject-verb agreement mismatch ("hand were" -> "hands were" or "hand was").

**Sample-level notes / transcription corrections:**

- _Add notes here._

## writing-16115

- Source: `samples/Narrative Writing/Narrative Writing/Writing_16115.pdf`
- Candidate model: `gemini-flash-latest`
- Candidate latency: 30538 ms
- AI illegibility note: none
- Reviewer sample characteristics: handwriting `[ ] neat  [ ] messy  [ ] mixed`; text `[ ] short  [ ] long`; format `[ ] narrative  [ ] edit/diagram`

| ID                 | Written      | Intended     | Category       | AI confidence | AI rationale                                                      | Human verdict / correction |
| ------------------ | ------------ | ------------ | -------------- | ------------: | ----------------------------------------------------------------- | -------------------------- |
| writing-16115-e001 | tipical      | typical      | orthographic   |          0.95 | Misspelled 'typical' with an 'i'.                                 |                            |
| writing-16115-e002 | tuesday      | Tuesday      | capitalisation |          0.98 | Day of the week should be capitalized.                            |                            |
| writing-16115-e003 | lauging      | laughing     | orthographic   |          0.95 | Missing 'h' in 'laughing'.                                        |                            |
| writing-16115-e004 | anther       | another      | orthographic   |          0.90 | Misspelled 'another'.                                             |                            |
| writing-16115-e005 | kindergarden | kindergarten | phonological   |          0.92 | Used 'd' instead of 't' in 'kindergarten'.                        |                            |
| writing-16115-e006 | firday       | Friday       | orthographic   |          0.95 | Transposed letters in 'Friday' and missing capitalisation.        |                            |
| writing-16115-e007 | anothre      | another      | orthographic   |          0.90 | Transposed letters in 'another'.                                  |                            |
| writing-16115-e008 | movment      | movement     | orthographic   |          0.95 | Missing 'e' in 'movement'.                                        |                            |
| writing-16115-e009 | assinged     | assigned     | orthographic   |          0.95 | Transposed letters in 'assigned'.                                 |                            |
| writing-16115-e010 | buch         | bunch        | orthographic   |          0.90 | Missing 'n' in 'bunch'.                                           |                            |
| writing-16115-e011 | tabdle       | table        | orthographic   |          0.92 | Extraneous 'd' in 'table'.                                        |                            |
| writing-16115-e012 | poped        | popped       | orthographic   |          0.95 | Missing double consonant in 'popped'.                             |                            |
| writing-16115-e013 | wold         | would        | orthographic   |          0.95 | Misspelled 'would'.                                               |                            |
| writing-16115-e014 | possible     | possibly     | morphological  |          0.92 | Used adjective 'possible' instead of adverb 'possibly'.           |                            |
| writing-16115-e015 | happen       | happened     | morphological  |          0.90 | Missing past tense suffix -ed.                                    |                            |
| writing-16115-e016 | abbsalutly   | absolutely   | orthographic   |          0.95 | Misspelled 'absolutely'.                                          |                            |
| writing-16115-e017 | oh           | Oh           | capitalisation |          0.90 | First word of direct speech should be capitalized.                |                            |
| writing-16115-e018 | angryly      | angrily      | orthographic   |          0.95 | Misspelled 'angrily'.                                             |                            |
| writing-16115-e019 | walk         | walked       | morphological  |          0.92 | Missing past tense marker -ed.                                    |                            |
| writing-16115-e020 | partented    | partnered    | orthographic   |          0.88 | Misspelled 'partnered'.                                           |                            |
| writing-16115-e021 | forgiven     | forgave      | morphological  |          0.92 | Used past participle 'forgiven' instead of past simple 'forgave'. |                            |
| writing-16115-e022 | expireants   | experience   | orthographic   |          0.88 | Misspelled 'experience'.                                          |                            |
| writing-16115-e023 | damage       | damaged      | morphological  |          0.92 | Passive form requires past participle 'damaged'.                  |                            |
| writing-16115-e024 | clam         | calm         | orthographic   |          0.95 | Transposed letters in 'calm'.                                     |                            |

All accepted

**Reviewer-added errors missed by AI:**

| Written | Intended | Category | Rationale |

**Sample-level notes / transcription corrections:**

- _Add notes here._

## writing-16145

- Source: `samples/Narrative Writing/Narrative Writing/Writing_16145.pdf`
- Candidate model: `hermes-gpt-5.6-visual-review`
- Candidate latency: None ms
- AI illegibility note: Most of the three-line response is difficult to transcribe confidently; manual review of the original scan is required.
- Reviewer sample characteristics: handwriting `[ ] neat  [ ] messy  [ ] mixed`; text `[ ] short  [ ] long`; format `[ ] narrative  [ ] edit/diagram`

| ID                 | Written | Intended | Category     | AI confidence | AI rationale                                                             | Human verdict / correction                  |
| ------------------ | ------- | -------- | ------------ | ------------: | ------------------------------------------------------------------------ | ------------------------------------------- |
| writing-16145-e001 | Becase  | Because  | orthographic |          0.82 | Likely omission of 'u' in 'Because'; surrounding handwriting is unclear. | edit: written="Because", intended="Because" |

Should not be used because it is genuinely unreadable

**Reviewer-added errors missed by AI:**

| Written | Intended | Category | Rationale |
| ------- | -------- | -------- | --------- |
|         |          |          |           |

**Sample-level notes / transcription corrections:**

- _Add notes here._

## student-121606

- Source: `samples/Edit&Diagram 1/Edit&Diagram 1/Student-121606.jpg`
- Candidate model: `hermes-gpt-5.6-visual-review`
- Candidate latency: None ms
- AI illegibility note: Several short responses are faint; verify exact wording against the scan.
- Reviewer sample characteristics: handwriting `[ ] neat  [ ] messy  [ ] mixed`; text `[ ] short  [ ] long`; format `[ ] narrative  [ ] edit/diagram`

| ID                  | Written      | Intended  | Category      | AI confidence | AI rationale                                                                           | Human verdict / correction                                                                                                                              |
| ------------------- | ------------ | --------- | ------------- | ------------: | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| student-121606-e001 | Fox hunt     | Fox hunts | morphological |          0.90 | Third-person singular verb likely requires -s.                                         | ok                                                                                                                                                      |
| student-121606-e002 | I am sang    | I sang    | morphological |          0.78 | The auxiliary 'am' is incompatible with the past-tense form 'sang'.                    | ok                                                                                                                                                      |
| student-121606-e003 | Pam swimming | Pam swims | morphological |          0.72 | The response appears to use a participle without an auxiliary; exact wording is faint. | edit: written="Pam Swimming?", intended="Pam swims.", category="morphological", rationale="Exact written text ends with question mark: 'Pam Swimming?'" |
| student-121606-e004 | Tom Jump     | Tom jumps | morphological |          0.86 | Third-person singular verb likely requires -s.                                         | edit: written="tom Jump", intended="Tom jumps.", category="morphological", rationale="Preserved exact lowercase 'tom Jump'."                            |

**Reviewer-added errors missed by AI:**

| Written | Intended | Category | Rationale |
he run. He ran. morphological/grammar Missing capitalization on 'he' and incorrect verb tense 'run'.

**Sample-level notes / transcription corrections:**

- _Add notes here._

## student-390968

- Source: `samples/Edit&Diagram 1/Edit&Diagram 1/Student-390968.jpg`
- Candidate model: `hermes-gpt-5.6-visual-review`
- Candidate latency: None ms
- AI illegibility note: none
- Reviewer sample characteristics: handwriting `[ ] neat  [ ] messy  [ ] mixed`; text `[ ] short  [ ] long`; format `[ ] narrative  [ ] edit/diagram`

| ID                  | Written | Intended | Category    | AI confidence | AI rationale                                                                 | Human verdict / correction |
| ------------------- | ------- | -------- | ----------- | ------------: | ---------------------------------------------------------------------------- | -------------------------- |
| student-390968-e001 | I sang, | I sang.  | punctuation |          0.80 | The standalone sentence appears to end with a comma rather than a full stop. |                            |

**Reviewer-added errors missed by AI:**

| Written | Intended | Category | Rationale |
| ------- | -------- | -------- | --------- |
|         |          |          |           |

**Sample-level notes / transcription corrections:**

- _Add notes here._

## student-89037

- Source: `samples/Edit&Diagram 1/Edit&Diagram 1/Student-89037.jpg`
- Candidate model: `hermes-gpt-5.6-visual-review`
- Candidate latency: None ms
- AI illegibility note: none
- Reviewer sample characteristics: handwriting `[ ] neat  [ ] messy  [ ] mixed`; text `[ ] short  [ ] long`; format `[ ] narrative  [ ] edit/diagram`

| ID  | Written | Intended | Category | AI confidence | AI rationale                                           | Human verdict / correction |
| --- | ------- | -------- | -------- | ------------: | ------------------------------------------------------ | -------------------------- |
| —   | —       | —        | —        |             — | AI proposed no errors; verify this is a true negative. |                            |

**Reviewer-added errors missed by AI:**

| Written | Intended | Category | Rationale |
| ------- | -------- | -------- | --------- |
|         |          |          |           |

**Sample-level notes / transcription corrections:**

- _Add notes here._

## student-82935

- Source: `samples/Edit&Diagram 3/Edit&Diagram 3/Student-82935.pdf`
- Candidate model: `hermes-gpt-5.6-visual-review`
- Candidate latency: None ms
- AI illegibility note: Crossed-out writing in the first response was ignored.
- Reviewer sample characteristics: handwriting `[ ] neat  [ ] messy  [ ] mixed`; text `[ ] short  [ ] long`; format `[ ] narrative  [ ] edit/diagram`

| ID                 | Written         | Intended       | Category | AI confidence | AI rationale                                                                                                      | Human verdict / correction |
| ------------------ | --------------- | -------------- | -------- | ------------: | ----------------------------------------------------------------------------------------------------------------- | -------------------------- |
| student-82935-e001 | at his bed room | in his bedroom | unsure   |          0.74 | The location phrase likely needs 'in', and 'bedroom' is normally one word; this combines grammar and orthography. |                            |

**Reviewer-added errors missed by AI:**

| Written | Intended | Category | Rationale |
| ------- | -------- | -------- | --------- |
|         |          |          |           |

**Sample-level notes / transcription corrections:**

- _Add notes here._

## student-94156

- Source: `samples/Edit&Diagram 3/Edit&Diagram 3/Student-94156.pdf`
- Candidate model: `hermes-gpt-5.6-visual-review`
- Candidate latency: None ms
- AI illegibility note: The final word or phrase after “because he got” is unclear.
- Reviewer sample characteristics: handwriting `[ ] neat  [ ] messy  [ ] mixed`; text `[ ] short  [ ] long`; format `[ ] narrative  [ ] edit/diagram`

| ID                 | Written                | Intended                  | Category      | AI confidence | AI rationale                                                                | Human verdict / correction                                                |
| ------------------ | ---------------------- | ------------------------- | ------------- | ------------: | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| student-94156-e001 | because bird has wing. | because birds have wings. | morphological |          0.94 | Plural subject and noun require plural marking and agreement.               |                                                                           |
| student-94156-e002 | at 4:00,               | at 4:00.                  | punctuation   |          0.82 | The completed sentence appears to end with a comma rather than a full stop. | reject: sentence written on scan clearly ends with a period ('at 4:00.'). |

**Reviewer-added errors missed by AI:**

| Written | Intended | Category | Rationale |
| ------- | -------- | -------- | --------- |

**Sample-level notes / transcription corrections:**

- _Add notes here._

## student-284857

- Source: `samples/Edit&Diagram 3/Edit&Diagram 3/Student-284857.pdf`
- Candidate model: `hermes-gpt-5.6-visual-review`
- Candidate latency: None ms
- AI illegibility note: none
- Reviewer sample characteristics: handwriting `[ ] neat  [ ] messy  [ ] mixed`; text `[ ] short  [ ] long`; format `[ ] narrative  [ ] edit/diagram`

| ID                  | Written              | Intended            | Category       | AI confidence | AI rationale                                        | Human verdict / correction |
| ------------------- | -------------------- | ------------------- | -------------- | ------------: | --------------------------------------------------- | -------------------------- |
| student-284857-e001 | friday               | Friday              | capitalisation |          0.98 | Day of the week should begin with a capital letter. |                            |
| student-284857-e002 | for a running races. | for a running race. | morphological  |          0.86 | Singular determiner 'a' requires singular 'race'.   |                            |

**Reviewer-added errors missed by AI:**

| Written | Intended | Category | Rationale |
| ------- | -------- | -------- | --------- |

**Sample-level notes / transcription corrections:**

- _Add notes here._

## Promotion checklist

- [x] Every page of every selected PDF was checked.
- [x] Every AI row has an accept/edit/reject decision, with blank cells treated as accepted per reviewer instruction.
- [x] Missed errors were added.
- [x] Exact child `written` text was preserved.
- [x] Categories use only the fixed LexiPath taxonomy.
- [x] Candidate JSON files were corrected and changed to `reviewStatus: "vetted"`.
- [x] Corrected files were copied to `evaluation/ground-truth-vetted/`.
- [x] `node evaluation/scripts/validate-ground-truth.mjs` passes.
