import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { preprocessImageForAnalysis } from './imagePreprocessor.js';

async function pixelAt(buffer, x, y) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * info.channels;
  return Array.from(data.subarray(offset, offset + info.channels));
}

test('preprocessImageForAnalysis applies EXIF rotation and emits PNG', async () => {
  const input = await sharp({
    create: { width: 80, height: 40, channels: 3, background: 'white' },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();

  const output = await preprocessImageForAnalysis(input, { trim: false });
  const metadata = await sharp(output).metadata();

  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 40);
  assert.equal(metadata.height, 80);
});

test('preprocessImageForAnalysis trims a plain background', async () => {
  const foreground = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#202020' },
  })
    .png()
    .toBuffer();
  const input = await sharp({
    create: { width: 100, height: 90, channels: 3, background: 'white' },
  })
    .composite([{ input: foreground, left: 30, top: 30 }])
    .png()
    .toBuffer();

  const output = await preprocessImageForAnalysis(input);
  const metadata = await sharp(output).metadata();

  assert.ok(metadata.width < 100, `expected trimmed width, got ${metadata.width}`);
  assert.ok(metadata.height < 90, `expected trimmed height, got ${metadata.height}`);
});

test('preprocessImageForAnalysis removes red annotations but preserves dark writing', async () => {
  const red = await sharp({
    create: { width: 20, height: 60, channels: 3, background: '#e02020' },
  })
    .png()
    .toBuffer();
  const black = await sharp({
    create: { width: 20, height: 60, channels: 3, background: '#202020' },
  })
    .png()
    .toBuffer();
  const input = await sharp({
    create: { width: 80, height: 60, channels: 3, background: 'white' },
  })
    .composite([
      { input: red, left: 15, top: 0 },
      { input: black, left: 45, top: 0 },
    ])
    .png()
    .toBuffer();

  const output = await preprocessImageForAnalysis(input, { trim: false });
  const redArea = await pixelAt(output, 25, 30);
  const blackArea = await pixelAt(output, 55, 30);

  assert.ok(redArea[0] > 240, `expected removed red annotation to become light, got ${redArea}`);
  assert.ok(blackArea[0] < 80, `expected dark writing to remain dark, got ${blackArea}`);
});

test('preprocessImageForAnalysis rejects non-image input', async () => {
  await assert.rejects(
    preprocessImageForAnalysis(Buffer.from('not an image')),
    /Could not preprocess image/
  );
});
