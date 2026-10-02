const PILOT_FORMS = new Set([
  'example-pair',
  'skill-description',
  'teacher-observation',
  'multi-example',
]);

export function resourceIdFromBlobPath(blobPath) {
  const match = String(blobPath).match(
    /(?:^|\/)wiki\/projects\/das-learning-resources\/resources\/(das-src-[^/]+)\.md$/
  );
  return match?.[1] ?? null;
}

export function runtimeInputFor(query) {
  return structuredClone(query.input);
}

export function validatePilot({ families, queries }) {
  if (families.length !== 4) throw new Error('Pilot must contain exactly 4 families.');
  if (queries.length !== 16) throw new Error('Pilot must contain exactly 16 queries.');

  const familyIds = new Set(families.map((family) => family.familyId));
  if (familyIds.size !== families.length) throw new Error('Family IDs must be unique.');
  for (const family of families) {
    if (!Array.isArray(family.acceptableResourceIds) || family.acceptableResourceIds.length === 0) {
      throw new Error(`Family ${family.familyId} has no acceptable resources.`);
    }
    const familyQueries = queries.filter((query) => query.familyId === family.familyId);
    const forms = new Set(familyQueries.map((query) => query.form));
    if (
      familyQueries.length !== 4 ||
      forms.size !== PILOT_FORMS.size ||
      [...forms].some((form) => !PILOT_FORMS.has(form))
    ) {
      throw new Error(`Family ${family.familyId} must contain the four pilot query forms.`);
    }
  }
  if (new Set(queries.map((query) => query.queryId)).size !== queries.length) {
    throw new Error('Query IDs must be unique.');
  }
  if (queries.some((query) => !familyIds.has(query.familyId) || !query.input?.errors?.length)) {
    throw new Error('Every query must reference a family and contain runtime error evidence.');
  }
}

export function scorePilot({ families, queries, rankedByQuery }) {
  const familyById = new Map(families.map((family) => [family.familyId, family]));
  const scoredQueries = queries.map((query) => {
    const family = familyById.get(query.familyId);
    if (!family) throw new Error(`Unknown family: ${query.familyId}`);

    const rankedResourceIds = rankedByQuery.get(query.queryId) ?? [];
    const acceptable = new Set(family.acceptableResourceIds);
    const matchIndex = rankedResourceIds.findIndex((resourceId) => acceptable.has(resourceId));
    const rank = matchIndex === -1 ? null : matchIndex + 1;
    const topThree = rankedResourceIds.slice(0, 3);
    const topThreeWrongResources = topThree.filter(
      (resourceId) => !resourceId.startsWith('non-resource:') && !acceptable.has(resourceId)
    );
    const failureReason =
      rank === null
        ? rankedResourceIds.length === 0
          ? 'no-results'
          : 'acceptable-family-not-retrieved'
        : rank > 3
          ? topThreeWrongResources.length > 0
            ? 'wrong-resource-family-outranks-family'
            : 'non-resource-documents-outrank-family'
          : rank > 1
            ? 'top-1-miss'
            : null;

    return {
      queryId: query.queryId,
      familyId: query.familyId,
      rank,
      top1Hit: rank === 1,
      top3Hit: rank !== null && rank <= 3,
      failureReason,
    };
  });

  const familiesAllVariantsAt3 = families.filter((family) => {
    const familyQueries = scoredQueries.filter((query) => query.familyId === family.familyId);
    return familyQueries.length === 4 && familyQueries.every((query) => query.top3Hit);
  }).length;

  return {
    summary: {
      queries: scoredQueries.length,
      top1Hits: scoredQueries.filter((query) => query.top1Hit).length,
      top3Hits: scoredQueries.filter((query) => query.top3Hit).length,
      familiesAllVariantsAt3,
      families: families.length,
    },
    queries: scoredQueries,
  };
}
