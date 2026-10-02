import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ERROR_CATEGORIES } from '../models/sample.js';
import { AppError } from '../utils/appError.js';

export const DEFAULT_WORKSHEET_SECTIONS_PATH = fileURLToPath(
  new URL('../data/worksheetSections.json', import.meta.url)
);

function catalogueError(message) {
  return new AppError(500, 'WORKSHEET_SECTION_CATALOGUE_INVALID', message);
}

export async function loadWorksheetSections(filePath, catalogueMode) {
  const resolved = path.resolve(filePath ?? DEFAULT_WORKSHEET_SECTIONS_PATH);
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(resolved, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw catalogueError('The worksheet section catalogue is not valid JSON.');
    }
    throw new AppError(
      500,
      'WORKSHEET_SECTION_CATALOGUE_UNAVAILABLE',
      'The worksheet section catalogue could not be read.'
    );
  }
  if (!Array.isArray(parsed)) {
    throw catalogueError('The worksheet section catalogue must be an array.');
  }
  return parsed.filter(
    (section) => !section.catalogueMode || section.catalogueMode === catalogueMode
  );
}

export function validateWorksheetSections(sections, worksheets) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new AppError(
      500,
      'WORKSHEET_SECTION_CATALOGUE_EMPTY',
      'No approved worksheet sections are configured for this recommendation mode.'
    );
  }
  const worksheetsById = new Map(worksheets.map((worksheet) => [worksheet.worksheetId, worksheet]));
  const seen = new Set();

  return sections.map((section, index) => {
    const label = `worksheetSections[${index}]`;
    const worksheet = worksheetsById.get(section?.worksheetId);
    if (!worksheet) {
      throw catalogueError(
        `${label}.worksheetId does not exist in the approved worksheet catalogue.`
      );
    }
    if (!Number.isInteger(section.pageStart) || section.pageStart < 1) {
      throw catalogueError(`${label}.pageStart must be an integer greater than or equal to 1.`);
    }
    if (!Number.isInteger(section.pageEnd) || section.pageEnd < section.pageStart) {
      throw catalogueError(
        `${label}.pageEnd must be an integer greater than or equal to pageStart.`
      );
    }
    const pageCount = section.pageEnd - section.pageStart + 1;
    if (pageCount < 2 || pageCount > 3) {
      throw catalogueError(`${label} must cover exactly 2 or 3 pages.`);
    }
    if (
      !Array.isArray(section.targetCategories) ||
      section.targetCategories.length === 0 ||
      section.targetCategories.some((category) => !ERROR_CATEGORIES.includes(category))
    ) {
      throw catalogueError(`${label}.targetCategories contains an unsupported category.`);
    }
    const key = `${section.worksheetId}:${section.pageStart}:${section.pageEnd}`;
    if (seen.has(key)) {
      throw catalogueError(`${label} duplicates an existing worksheet page range.`);
    }
    seen.add(key);

    return {
      worksheetId: worksheet.worksheetId,
      title: section.title || worksheet.title,
      pdfPath: worksheet.pdfPath,
      pageStart: section.pageStart,
      pageEnd: section.pageEnd,
      pdfPages: `${section.pageStart}-${section.pageEnd}`,
      targetCategories: [...new Set(section.targetCategories)],
      errorPatterns: [...new Set(section.targetCategories)],
      skill: String(section.skill ?? ''),
      difficulty: String(section.difficulty ?? ''),
      description: String(section.description ?? worksheet.description ?? ''),
      available: worksheet.available ?? false,
    };
  });
}
