# Retrieval robustness pilot

- Corpus: local Azure deployment mirror (578 Markdown documents)
- Queries: 16
- Top-1 family hit: 0/16 (0.0%)
- Top-3 family hit: 0/16 (0.0%)
- All four variants succeed @3: 0/4 families

| Family | Query form | First acceptable rank | Top 1 | Top 3 | Failure reason |
|---|---|---:|:---:|:---:|---|
| Ordering events and using sequence language | example-pair | 151 | no | no | non-resource-documents-outrank-family |
| Ordering events and using sequence language | skill-description | 117 | no | no | non-resource-documents-outrank-family |
| Ordering events and using sequence language | teacher-observation | 202 | no | no | non-resource-documents-outrank-family |
| Ordering events and using sequence language | multi-example | 81 | no | no | wrong-resource-family-outranks-family |
| Dividing two-syllable words between consonants | example-pair | 117 | no | no | non-resource-documents-outrank-family |
| Dividing two-syllable words between consonants | skill-description | 430 | no | no | non-resource-documents-outrank-family |
| Dividing two-syllable words between consonants | teacher-observation | 15 | no | no | non-resource-documents-outrank-family |
| Dividing two-syllable words between consonants | multi-example | 72 | no | no | wrong-resource-family-outranks-family |
| Choosing synonyms by meaning and strength | example-pair | 121 | no | no | non-resource-documents-outrank-family |
| Choosing synonyms by meaning and strength | skill-description | 171 | no | no | wrong-resource-family-outranks-family |
| Choosing synonyms by meaning and strength | teacher-observation | 10 | no | no | wrong-resource-family-outranks-family |
| Choosing synonyms by meaning and strength | multi-example | 75 | no | no | wrong-resource-family-outranks-family |
| Choosing spellings for the long o sound | example-pair | 25 | no | no | non-resource-documents-outrank-family |
| Choosing spellings for the long o sound | skill-description | 69 | no | no | non-resource-documents-outrank-family |
| Choosing spellings for the long o sound | teacher-observation | 7 | no | no | wrong-resource-family-outranks-family |
| Choosing spellings for the long o sound | multi-example | 7 | no | no | wrong-resource-family-outranks-family |

