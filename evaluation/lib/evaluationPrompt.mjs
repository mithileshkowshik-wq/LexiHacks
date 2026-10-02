export const ERROR_CATEGORIES = [
  "phonological",
  "orthographic",
  "morphological",
  "capitalisation",
  "punctuation",
  "unsure",
];

export const MINIMAL_GUARDRAILS = [
  "Preserve the child's apparent text exactly in written; do not silently correct or paraphrase it.",
  "Ignore printed instructions and teacher markings, including red corrections, underlines, ticks, crosses, and comments.",
  "Do not guess illegible words. Use [illegible] in the transcript or describe the span in illegibleNote with low confidence.",
];

export const FULL_GUARDRAILS = [
  "If unsure whether a word is misspelled or merely unclear, put it in illegibleNote or use lower confidence.",
  "Never normalize spelling, capitalization, punctuation, or grammar in written.",
  MINIMAL_GUARDRAILS[0],
  "written and intended must differ for spelling, grammar, punctuation, or capitalization corrections unless the issue is purely location/category uncertainty.",
  MINIMAL_GUARDRAILS[1],
  MINIMAL_GUARDRAILS[2],
  "Use unsure with low confidence for grammar or phrase issues that do not fit the fixed categories cleanly.",
];

export function buildEvaluationPrompt(
  sample,
  {
    guardrails,
    guardrailProfile = guardrails === false ? "none" : "full",
  } = {},
) {
  const profiles = {
    none: [],
    minimal: MINIMAL_GUARDRAILS,
    full: FULL_GUARDRAILS,
  };
  const rules = profiles[guardrailProfile];
  if (!rules)
    throw new Error(`Unsupported guardrail profile: ${guardrailProfile}`);
  const guardrailText = rules.length
    ? `\nGuardrails:\n${rules.map((rule) => `- ${rule}`).join("\n")}\n`
    : "";

  return `You are independently evaluating a child's handwritten schoolwork.
Do not use or infer any answer key, prior annotation, model output, correction table, or ground truth.
Read only the supplied page image(s). Identify every visible literacy error and return JSON only.
Task type: ${sample.taskType || "UNKNOWN"}.
Allowed categories: ${ERROR_CATEGORIES.join(", ")}.
${guardrailText}
Return this shape:
{
  "transcript": "line-by-line apparent transcription",
  "illegibleNote": "unclear spans or empty string",
  "errors": [
    {
      "written": "exact apparent child text",
      "intended": "best correction",
      "category": "one allowed category",
      "confidenceScore": 0.0,
      "note": "short rationale"
    }
  ]
}
Do not include Markdown fences or commentary outside the JSON.`;
}
