import fs from 'node:fs/promises';
import path from 'node:path';
import { pdf as renderPdf } from 'pdf-to-img';
import { preprocessImageForAnalysis } from './imagePreprocessor.js';

function mimeTypeFor(sourceFile) {
  const extension = path.extname(sourceFile).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  throw new Error(`Unsupported evaluation image type: ${extension || 'unknown'}`);
}

export async function loadEvaluationPages(sourceFile, { preprocess = true } = {}) {
  let pages;
  if (path.extname(sourceFile).toLowerCase() === '.pdf') {
    const document = await renderPdf(sourceFile, { scale: 2 });
    pages = [];
    for await (const page of document) pages.push({ data: page, mimeType: 'image/png' });
  } else {
    pages = [{ data: await fs.readFile(sourceFile), mimeType: mimeTypeFor(sourceFile) }];
  }

  if (!preprocess) return pages;

  return Promise.all(
    pages.map(async ({ data }) => ({
      data: await preprocessImageForAnalysis(data),
      mimeType: 'image/png',
    }))
  );
}
