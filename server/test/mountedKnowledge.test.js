import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MountedKnowledgeSource, RecommendationEngine } from '../services/recommendationEngine.js';

const silent = { info() {} };

async function removeFixture(directory, prefix) {
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(directory).startsWith(prefix));
  await fs.rm(directory, { recursive: true, force: true });
}

async function fixture(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lexipath-knowledge-test-'));
  try {
    await fs.mkdir(path.join(root, '_manifests'));
    await fs.mkdir(path.join(root, 'wiki'));
    await fs.mkdir(path.join(root, '_raw'));
    await fs.writeFile(
      path.join(root, '_manifests/gemini-canonical-markdown.jsonl'),
      JSON.stringify({ path: 'wiki/phonics.md' }) + '\n'
    );
    await fs.writeFile(
      path.join(root, 'wiki/phonics.md'),
      '---\ndocumentType: "resource"\n---\n# Phonics\nShort vowel sound practice.'
    );
    await fs.writeFile(path.join(root, '_raw/phonics.pdf'), '%PDF-1.7\nsynthetic test PDF bytes');
    await fs.writeFile(
      path.join(root, '_manifests/blob-upload-manifest.json'),
      JSON.stringify({
        files: [
          { path: '_raw/phonics.pdf', sha256: '0123456789abcdef00', displayName: 'phonics.pdf' },
        ],
      })
    );
    await run(root);
  } finally {
    await removeFixture(root, 'lexipath-knowledge-test-');
  }
}

test('mounted corpus retrieves real files without any Azure configuration or network fetch', async () => {
  await fixture(async (root) => {
    const source = new MountedKnowledgeSource({
      root,
      logger: silent,
      fetchImpl: () => assert.fail('Network access is forbidden'),
    });
    const input = { errors: [{ category: 'phonological', written: 'kat', note: 'short vowel' }] };
    assert.match(await source.contextFor(input, 1), /Short vowel sound practice/);
    const catalogue = await source.worksheetCatalogue();
    assert.equal(catalogue[0].worksheetId, 'azure-0123456789abcdef');
    const engine = new RecommendationEngine({
      storageProvider: 'mounted',
      knowledgeRoot: root,
      useMocks: false,
      logger: silent,
      approvedSections: [
        {
          worksheetId: catalogue[0].worksheetId,
          pageStart: 1,
          pageEnd: 2,
          targetCategories: ['phonological'],
        },
      ],
    });
    assert.equal(engine.azureSource, null);
    assert.equal(engine.getStatus().storageProvider, 'mounted');
    const download = await engine.fetchWorksheet(catalogue[0].worksheetId);
    assert.equal(download.response.headers.get('content-type'), 'application/pdf');
    assert.match(await download.response.text(), /^%PDF-/);
    await assert.rejects(engine.fetchWorksheet('invented-id'), { code: 'WORKSHEET_NOT_FOUND' });
  });
});

test('mounted reader rejects traversal, directories, missing files and oversized documents', async () => {
  await fixture(async (root) => {
    const source = new MountedKnowledgeSource({ root, logger: silent });
    for (const invalid of [
      '../outside.txt',
      '/absolute.txt',
      'wiki\\phonics.md',
      'wiki/../phonics.md',
    ]) {
      await assert.rejects(source.fetchBlob(invalid), { code: 'INVALID_BLOB_PATH' });
    }
    await assert.rejects(source.fetchBlob('wiki'), { code: 'INVALID_BLOB_PATH' });
    await assert.rejects(source.fetchBlob('missing.pdf'), { code: 'KNOWLEDGE_FILE_UNAVAILABLE' });
    await assert.rejects(source.readText('wiki/phonics.md', 5), { code: 'AZURE_BLOB_TOO_LARGE' });
  });
});

test('mounted reader prevents a symbolic directory link escaping its resource root', async (context) => {
  await fixture(async (root) => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'lexipath-knowledge-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'private.txt'), 'synthetic outside content');
      try {
        await fs.symlink(outside, path.join(root, 'escape'), 'junction');
      } catch (error) {
        if (error.code === 'EPERM') {
          context.skip('Symbolic links unavailable');
          return;
        }
        throw error;
      }
      const source = new MountedKnowledgeSource({ root, logger: silent });
      await assert.rejects(source.fetchBlob('escape/private.txt'), { code: 'INVALID_BLOB_PATH' });
    } finally {
      await removeFixture(outside, 'lexipath-knowledge-outside-');
    }
  });
});

test('retrieved context stays bounded while retaining both resource and teacher evidence', async () => {
  await fixture(async (root) => {
    await fs.writeFile(
      path.join(root, 'wiki/phonics.md'),
      '---\ndocumentType: "resource"\n---\n' + 'Short vowel phonological practice. '.repeat(1000)
    );
    await fs.writeFile(
      path.join(root, 'wiki/teacher.md'),
      '---\ndocumentType: "teacher_knowledge"\n---\n' +
        'Short vowel phonological teaching. '.repeat(1000)
    );
    await fs.writeFile(
      path.join(root, '_manifests/gemini-canonical-markdown.jsonl'),
      ['wiki/phonics.md', 'wiki/teacher.md']
        .map((file) => JSON.stringify({ path: file }))
        .join('\n')
    );
    const source = new MountedKnowledgeSource({ root, logger: silent, maxContextCharacters: 1000 });
    const context = await source.contextFor({
      errors: [{ category: 'phonological', note: 'short vowel' }],
    });
    assert.ok(context.length <= 1000);
    assert.match(context, /RESOURCE CANDIDATE/);
    assert.match(context, /TEACHER KNOWLEDGE/);
  });
});
