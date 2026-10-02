import sharp from 'sharp';

// Preserve full colour page geometry. EXIF is applied before detecting handwriting orientation.
export async function uprightPage(input, detectOrientation) {
  const page = await sharp(input).rotate().flatten({ background: 'white' }).png().toBuffer();
  const preview = await sharp(page)
    .resize({ width: 1400, withoutEnlargement: true })
    .png()
    .toBuffer();
  const result = await detectOrientation(preview);
  if (
    !result ||
    ![0, 90, 180, 270].includes(result.rotation) ||
    !Number.isFinite(result.confidence) ||
    result.confidence < 0 ||
    result.confidence > 1
  ) {
    throw new Error('Invalid page orientation response');
  }
  const rotation = result.confidence >= 0.8 ? result.rotation : 0;
  return sharp(page).rotate(rotation).png().toBuffer();
}
