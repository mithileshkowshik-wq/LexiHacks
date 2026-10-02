import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

const INPUT =
  'evaluation/retrieval/manual-pilot-packets.json';

const OUTPUT =
  'evaluation/retrieval/manual-prompts';

function show(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 'unknown';
  }

  return value;
}

function buildPrompt(packet) {
  const context =
    packet.studentContext;

  const errors =
    packet.errors
      .map(
        (error, index) => `
ERROR ${index + 1}
Written: ${error.written ?? ''}
Intended: ${error.intended ?? ''}
Reviewed category: ${error.category ?? 'unsure'}
Note: ${error.note ?? ''}
`.trim(),
      )
      .join('\n\n');

  const candidates =
    packet.candidates
      .map(
        (resource, index) => `
RESOURCE ${index + 1}

ID: ${resource.resourceId}
Title: ${resource.title}

Programme: ${show(resource.programme)}
Band: ${show(resource.band)}
Level: ${show(resource.level)}
Year: ${show(resource.year)}
Term: ${show(resource.term)}
Week: ${show(resource.week)}

Target skills:
${(resource.targetSkills ?? []).join(', ') || 'unknown'}

Addresses error types:
${(resource.addressesErrorTypes ?? []).join(', ') || 'unknown'}

Description:
${resource.description || 'No description available.'}
`.trim(),
      )
      .join('\n\n');

  const knowledge =
    packet.teacherKnowledge
      .map(
        (item, index) => `
DAS KNOWLEDGE ${index + 1}

${item.title}

${item.content}
`.trim(),
      )
      .join('\n\n');

  return `
You are assisting a Dyslexia Association of Singapore educator.

Your task is to select the most suitable EXISTING DAS teaching resources for this student.

You have four sources of information:

1. the student's actual observed errors;
2. the student's current programme context;
3. a closed list of eligible DAS resource candidates;
4. relevant DAS instructional knowledge.

Use semantic reasoning.

Do not simply choose the resource whose title contains the same words as the error.

Infer the underlying learning need from the student's actual written and intended forms.

DAS teacher knowledge should guide your reasoning.

IMPORTANT RULES

- The resource candidate list is a CLOSED SET.
- You may only select resource IDs provided below.
- Never invent a resource.
- Never invent a worksheet ID.
- Never invent a page number.
- Never modify a supplied resource ID.

PRIORITIES

1. The resource should directly address the observed error pattern.
2. Correct learning skill is more important than exact week.
3. Programme and student level should be suitable.
4. Target skills should align with the observed errors.
5. Use DAS instructional knowledge to guide the decision.
6. Year and term compatibility are useful.
7. Week proximity is a weaker preference because remediation may use earlier material.

STUDENT CONTEXT

Programme: ${show(context.programme)}
Band: ${show(context.band)}
Level: ${show(context.level)}
Programme Year: ${show(context.programmeYear)}
Term: ${show(context.term)}
Week: ${show(context.week)}

OBSERVED STUDENT ERRORS

${errors}

ELIGIBLE RESOURCE CANDIDATES

${candidates}

RELEVANT DAS TEACHER KNOWLEDGE

${knowledge}

Select up to THREE resources.

Order them from best to worst.

Return JSON only.

Use exactly this structure:

{
  "selections": [
    {
      "resourceId": "exact supplied resource ID",
      "rationale": "brief explanation connecting the resource to the student's observed errors"
    }
  ]
}
`.trim();
}

await mkdir(
  OUTPUT,
  {
    recursive: true,
  },
);

const packets =
  JSON.parse(
    await readFile(
      INPUT,
      'utf8',
    ),
  );

for (
  const packet
  of packets
) {
  /*
   * IMPORTANT:
   *
   * buildPrompt() never receives or
   * references acceptableResourceIds.
   *
   * Those remain evaluator-only.
   */

  const prompt =
    buildPrompt(packet);

  const outputPath =
    path.join(
      OUTPUT,
      `${packet.caseId}.txt`,
    );

  await writeFile(
    outputPath,
    `${prompt}\n`,
    'utf8',
  );

  console.log(
    `Generated ${outputPath}`,
  );
}

console.log('');
console.log(
  `Generated ${packets.length} prompts.`,
);