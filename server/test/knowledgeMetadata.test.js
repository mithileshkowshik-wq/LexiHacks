import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inferMetadataFromSourcePath,
  parseKnowledgeDocumentMetadata,
  rankKnowledgeDocuments,
} from '../services/recommendationEngine.js';
import { buildRecommendationContext } from '../services/studentContext.js';

const longOInput = {
  programme: 'SLP',
  band: 'B',
  level: 'secondary',
  gradeYear: 1,
  programmeYear: 1,
  term: 1,
  week: 4,
  errors: [
    { category: 'phonological', written: 'bote', intended: 'boat', note: 'long vowel oa ow' },
  ],
};

test('recommendation context preserves broad level and exact grade year', () => {
  assert.deepEqual(buildRecommendationContext({ currentGrade: 'Primary 4' }, []), {
    level: 'primary',
    gradeYear: 4,
    programme: null,
    band: null,
    programmeYear: null,
    term: null,
    week: null,
    errors: [],
  });
  assert.deepEqual(
    buildRecommendationContext({ currentGrade: 'Secondary 2' }, []).level,
    'secondary'
  );
  assert.equal(buildRecommendationContext({ currentGrade: 'P4' }, []).gradeYear, 4);
});

test('raw DAS source-path metadata parser handles real folder abbreviations', () => {
  assert.deepEqual(
    inferMetadataFromSourcePath(
      '_raw/Copy for Partners/SLP Band B Year 1 Term 1 Secondary/Band B Y1 T1 W4 Spelling/Practice (Sec).pdf'
    ),
    { programme: 'SLP', band: 'B', level: 'secondary', year: 1, term: 1, week: 4 }
  );
  assert.deepEqual(
    inferMetadataFromSourcePath(
      '_raw/Copy for Partners/SLP Band B Year 1 Term 1 Primary/Band B Y1T1 WK4 Reading P2.docx'
    ),
    { programme: 'SLP', band: 'B', level: 'primary', year: 1, term: 1, week: 4 }
  );
  assert.equal(
    inferMetadataFromSourcePath('SLP Band C Secondary - Year 1 Term 2 W10/foo.docx').term,
    2
  );
  assert.equal(
    inferMetadataFromSourcePath('SLP Band B Year 1 Term 1 Secondary/Band B Y1T1W4 P2.docx').level,
    'primary'
  );
});

test('document metadata honours explicit frontmatter before source-path inference', () => {
  const document = parseKnowledgeDocumentMetadata({
    blobPath: 'wiki/projects/das-learning-resources/resources/das-src-1.md',
    content: `---\ndocumentType: "resource"\nprogramme: "SLP"\nband: "C"\nlevel: "secondary"\nyear: 2\nterm: 3\nweek: 9\nsource_file: "_raw/Copy for Partners/SLP Band B Year 1 Term 1 Primary/Band B Y1T1W4.pdf"\n---\nLong vowel oa ow practice`,
  });

  assert.deepEqual(document.metadata, {
    documentType: 'resource',
    programme: 'SLP',
    band: 'C',
    level: 'secondary',
    year: 2,
    term: 3,
    week: 9,
    resourceType: null,
  });
});

test('ranker separates resources from teacher knowledge and applies compatibility as a reranker', () => {
  const documents = [
    {
      blobPath: 'wiki/projects/das-learning-resources/concepts/long-vowels.md',
      content:
        '---\ndocumentType: "teacher_knowledge"\n---\nDAS protocol for long vowel intervention and oa ow spelling.',
    },
    {
      blobPath: 'wiki/projects/das-learning-resources/resources/right-skill-near-week.md',
      content:
        '---\ndocumentType: "resource"\nprogramme: "SLP"\nband: "B"\nlevel: "secondary"\nyear: 1\nterm: 1\nweek: 2\n---\nLong vowel oa ow spelling practice.',
    },
    {
      blobPath: 'wiki/projects/das-learning-resources/resources/wrong-skill-exact-week.md',
      content:
        '---\ndocumentType: "resource"\nprogramme: "SLP"\nband: "B"\nlevel: "secondary"\nyear: 1\nterm: 1\nweek: 4\n---\nCapital letters and punctuation editing.',
    },
    {
      blobPath: 'wiki/projects/das-learning-resources/resources/wrong-programme.md',
      content:
        '---\ndocumentType: "resource"\nprogramme: "ELL-MLP"\nband: "B"\nlevel: "secondary"\nyear: 1\nterm: 1\nweek: 4\n---\nLong vowel oa ow spelling practice.',
    },
  ];

  const resources = rankKnowledgeDocuments(documents, longOInput, {
    documentType: 'resource',
    limit: 5,
  });
  assert.equal(
    resources[0].blobPath,
    'wiki/projects/das-learning-resources/resources/right-skill-near-week.md'
  );
  assert.equal(
    resources.some((document) => document.blobPath.endsWith('wrong-programme.md')),
    false
  );
  assert.equal(
    resources.some((document) => document.metadata.documentType === 'teacher_knowledge'),
    false
  );

  const teacherKnowledge = rankKnowledgeDocuments(documents, longOInput, {
    documentType: 'teacher_knowledge',
    limit: 5,
  });
  assert.equal(teacherKnowledge[0].metadata.documentType, 'teacher_knowledge');
});
