import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  resourceIdFromBlobPath,
  runtimeInputFor,
  scorePilot,
  validatePilot,
} from '../lib/retrievalPilot.mjs';

test('scores family hits and requires all four variants to hit at three', () => {
  const families = [
    { familyId: 'family-a', acceptableResourceIds: ['resource-a'] },
    { familyId: 'family-b', acceptableResourceIds: ['resource-b', 'resource-b-equivalent'] },
  ];
  const queries = [
    { queryId: 'a-1', familyId: 'family-a' },
    { queryId: 'a-2', familyId: 'family-a' },
    { queryId: 'a-3', familyId: 'family-a' },
    { queryId: 'a-4', familyId: 'family-a' },
    { queryId: 'b-1', familyId: 'family-b' },
    { queryId: 'b-2', familyId: 'family-b' },
    { queryId: 'b-3', familyId: 'family-b' },
    { queryId: 'b-4', familyId: 'family-b' },
  ];
  const rankedByQuery = new Map([
    ['a-1', ['resource-a']],
    ['a-2', ['other', 'resource-a']],
    ['a-3', ['other', 'other-2', 'resource-a']],
    ['a-4', ['resource-a']],
    ['b-1', ['resource-b-equivalent']],
    ['b-2', ['other', 'resource-b']],
    ['b-3', ['other', 'other-2', 'other-3', 'resource-b']],
    ['b-4', []],
  ]);

  const result = scorePilot({ families, queries, rankedByQuery });

  assert.deepEqual(result.summary, {
    queries: 8,
    top1Hits: 3,
    top3Hits: 6,
    familiesAllVariantsAt3: 1,
    families: 2,
  });
  assert.equal(
    result.queries.find((item) => item.queryId === 'b-3').failureReason,
    'wrong-resource-family-outranks-family'
  );
  assert.equal(result.queries.find((item) => item.queryId === 'b-4').failureReason, 'no-results');
});

test('attributes top-three failures to non-resource or wrong-family results', () => {
  const families = [{ familyId: 'target', acceptableResourceIds: ['acceptable'] }];
  const queries = [
    { queryId: 'non-resource', familyId: 'target' },
    { queryId: 'wrong-family', familyId: 'target' },
  ];
  const rankedByQuery = new Map([
    [
      'non-resource',
      ['non-resource:wiki/skill.md', 'non-resource:wiki/error.md', 'non-resource:wiki/guide.md', 'acceptable'],
    ],
    [
      'wrong-family',
      ['non-resource:wiki/skill.md', 'wrong-resource', 'non-resource:wiki/guide.md', 'acceptable'],
    ],
  ]);

  const result = scorePilot({ families, queries, rankedByQuery });

  assert.equal(result.queries[0].failureReason, 'non-resource-documents-outrank-family');
  assert.equal(result.queries[1].failureReason, 'wrong-resource-family-outranks-family');
});

test('validates the 4 by 4 pilot and isolates the runtime payload from evaluator labels', () => {
  const forms = ['example-pair', 'skill-description', 'teacher-observation', 'multi-example'];
  const families = Array.from({ length: 4 }, (_, familyIndex) => ({
    familyId: `family-${familyIndex}`,
    acceptableResourceIds: [`resource-${familyIndex}`],
  }));
  const queries = families.flatMap((family) =>
    forms.map((form, formIndex) => ({
      queryId: `${family.familyId}-${formIndex}`,
      familyId: family.familyId,
      form,
      displayQuery: `Synthetic learner evidence ${family.familyId} ${formIndex}`,
      input: {
        errors: [{ id: 'e1', category: 'unsure', note: `Observed evidence ${formIndex}` }],
      },
    }))
  );

  assert.doesNotThrow(() => validatePilot({ families, queries }));
  const payload = runtimeInputFor(queries[0]);
  assert.deepEqual(payload, queries[0].input);
  assert.notEqual(payload, queries[0].input);
  assert.equal(JSON.stringify(payload).includes('family-0'), false);
  assert.throws(
    () => validatePilot({ families, queries: queries.slice(1) }),
    /exactly 16 queries/
  );
});

test('pilot fixtures contain 16 isolated queries and map resource-card paths to resource IDs', async () => {
  const families = JSON.parse(
    await readFile(new URL('../retrieval/pilot-families.json', import.meta.url), 'utf8')
  );
  const queries = JSON.parse(
    await readFile(new URL('../retrieval/pilot-queries.json', import.meta.url), 'utf8')
  );

  validatePilot({ families, queries });
  const hiddenResourceIds = families.flatMap((family) => family.acceptableResourceIds);
  for (const query of queries) {
    const payload = JSON.stringify(runtimeInputFor(query));
    assert.equal(hiddenResourceIds.some((resourceId) => payload.includes(resourceId)), false);
  }
  assert.equal(
    resourceIdFromBlobPath(
      'wiki/projects/das-learning-resources/resources/das-src-0427-synonyms-and-word-cline.md'
    ),
    'das-src-0427-synonyms-and-word-cline'
  );
  assert.equal(resourceIdFromBlobPath('wiki/projects/das-learning-resources/skills/sequencing.md'), null);
});
