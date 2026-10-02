function optionalString(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function optionalInteger(value) {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function levelFromGrade(grade) {
  const value = String(grade ?? '').toLowerCase();
  if (/\b(primary|p)\s*\d+/.test(value) || value.includes('primary')) return 'primary';
  if (/\b(sec(?:ondary)?|s)\s*\d+/.test(value) || value.includes('secondary')) return 'secondary';
  return null;
}

export function gradeYearFromGrade(grade) {
  const value = String(grade ?? '').toLowerCase();
  const match = value.match(/\b(?:primary|secondary|p|sec|s)\s*([0-9]{1,2})\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function buildRecommendationContext(student, errors) {
  return {
    level: levelFromGrade(student?.currentGrade),
    gradeYear: gradeYearFromGrade(student?.currentGrade),
    programme: optionalString(student?.programme),
    band: optionalString(student?.band)?.toUpperCase() ?? null,
    programmeYear: optionalInteger(student?.programmeYear),
    term: optionalInteger(student?.term),
    week: optionalInteger(student?.week),
    errors,
  };
}

export function placementFromBody(body) {
  return {
    programme: optionalString(body.programme),
    band: optionalString(body.band)?.toUpperCase() ?? null,
    programmeYear: optionalInteger(body.programmeYear),
    term: optionalInteger(body.term),
    week: optionalInteger(body.week),
  };
}

export function hasPlacement(student) {
  return ['programme', 'band', 'programmeYear', 'term', 'week'].some(
    (field) => student?.[field] != null && student[field] !== ''
  );
}
