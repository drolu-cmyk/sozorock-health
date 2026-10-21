export function translateSelection(selected: string, currentLabels: readonly string[], nextLabels: readonly string[]) {
  const index = currentLabels.indexOf(selected);
  return index < 0 ? "" : nextLabels[index] ?? "";
}
