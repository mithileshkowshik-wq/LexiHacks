import sharp from 'sharp';

const DEFAULTS = Object.freeze({
  trim: true,
  trimThreshold: 16,
  maxWidth: 2200,
  redMinimum: 140,
  redDominance: 1.25,
});

function removeRedAnnotations(data, channels, options) {
  for (let offset = 0; offset < data.length; offset += channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const isRedMark =
      red >= options.redMinimum &&
      red >= green * options.redDominance &&
      red >= blue * options.redDominance;

    if (isRedMark) {
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
    }
  }
}

/**
 * Creates an analysis-only PNG without modifying the uploaded source file.
 *
 * The narrow pipeline applies EXIF rotation, trims a plain page border,
 * removes strongly red annotations, and normalises greyscale contrast. It is
 * intentionally conservative: unclear coloured pixels that are not clearly
 * red are retained so handwriting is not silently erased.
 */
export async function preprocessImageForAnalysis(input, overrides = {}) {
  const options = { ...DEFAULTS, ...overrides };

  try {
    let pipeline = sharp(input, { failOn: 'error' })
      .rotate()
      .flatten({ background: 'white' })
      .removeAlpha();

    if (options.trim) {
      pipeline = pipeline.trim({ background: 'white', threshold: options.trimThreshold });
    }

    const { data, info } = await pipeline
      .resize({ width: options.maxWidth, withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    removeRedAnnotations(data, info.channels, options);

    return await sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    })
      .grayscale()
      .normalise()
      .sharpen({ sigma: 0.8 })
      .png()
      .toBuffer();
  } catch (error) {
    throw new Error('Could not preprocess image for analysis', { cause: error });
  }
}
