import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { uprightPage } from './pageOrientation.js';
import { preprocessImageForAnalysis } from './imagePreprocessor.js';

const source = () =>
  sharp(
    Buffer.from(
      '<svg width="120" height="80"><rect width="120" height="80" fill="white"/><rect x="10" y="10" width="20" height="20" fill="black"/></svg>'
    )
  )
    .png()
    .toBuffer();
for (const rotation of [0, 90, 180, 270]) {
  test(`upright page applies ${rotation} clockwise and keeps analysis coordinates aligned`, async () => {
    const input = await source();
    const actual = await uprightPage(input, async () => ({ rotation, confidence: 0.95 }));
    const expected = await sharp(input).rotate(rotation).png().toBuffer();
    assert.deepEqual(
      await sharp(actual).raw().toBuffer(),
      await sharp(expected).removeAlpha().raw().toBuffer()
    );
    const page = await sharp(actual).metadata();
    const analysis = await sharp(
      await preprocessImageForAnalysis(actual, { trim: false })
    ).metadata();
    assert.equal(analysis.width, page.width);
    assert.equal(analysis.height, page.height);
  });
}
test('EXIF orientation is applied before detection without rotating twice', async () => {
  const input = await sharp(await source())
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const actual = await uprightPage(input, async (preview) => {
    const meta = await sharp(preview).metadata();
    assert.equal(meta.width, 80);
    assert.equal(meta.height, 120);
    return { rotation: 0, confidence: 0.95 };
  });
  assert.equal((await sharp(actual).metadata()).width, 80);
});
test('ambiguous orientation preserves the page and malformed output is rejected', async () => {
  const input = await source();
  const actual = await uprightPage(input, async () => ({ rotation: 90, confidence: 0.3 }));
  assert.equal((await sharp(actual).metadata()).width, 120);
  await assert.rejects(
    uprightPage(input, async () => ({ rotation: 45, confidence: 1 })),
    /Invalid page orientation/
  );
});

test('Gemini orientation request uses string enums and parses the angle without losing confidence', async () => {
  const { __testing } = await import('./errorClassificationEngine.js');
  let request;
  const ai = {
    models: {
      generateContent: async (input) => {
        request = input;
        return { text: JSON.stringify({ rotation: '270', confidence: 0.95 }) };
      },
    },
  };
  const result = await __testing.detectPageOrientation(ai, await source(), {
    modelName: 'test-model',
    timeoutMs: 1000,
  });
  assert.deepEqual(request.config.responseSchema.properties.rotation, {
    type: 'string',
    enum: ['0', '90', '180', '270'],
  });
  assert.equal(request.contents[0].parts[1].inlineData.mimeType, 'image/png');
  assert.deepEqual(result, { rotation: 270, confidence: 0.95 });
});
