export function normalizeHeatMapDomain(
  minimumValue: number | null,
  maximumValue: number | null,
) {
  const minimum = minimumValue ?? 0;
  const reportedMaximum = maximumValue ?? minimum + 1;
  return {
    minimum,
    maximum: reportedMaximum > minimum ? reportedMaximum : minimum + 1,
  };
}
