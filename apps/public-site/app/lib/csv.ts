function neutralizeSpreadsheetFormula(text: string) {
  return /^[\t\r]/.test(text) || /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return `"${neutralizeSpreadsheetFormula(text).replace(/"/g, '""')}"`;
}
