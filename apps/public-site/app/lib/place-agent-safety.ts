export function isClinicalSafetyQuestion(question: string) {
  const normalized = question.toLowerCase();
  return /\b(diagnos(?:e|is|ed|ing)?|symptoms?|triag(?:e|ed|ing)|treat(?:ment|ed|ing)?|medications?|dos(?:e|age|ing)|prescrib(?:e|ed|ing)|my risk|am i)\b/.test(normalized);
}
