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

export const COUNTY_HEAT_MAP_COLORS = [
  "#e7f0e5",
  "#b8d2b1",
  "#79aa78",
  "#397650",
  "#123f32",
] as const;

export function countyHeatMapStops(minimumValue: number | null, maximumValue: number | null) {
  const { minimum, maximum } = normalizeHeatMapDomain(minimumValue, maximumValue);
  const interval = (maximum - minimum) / (COUNTY_HEAT_MAP_COLORS.length - 1);
  return COUNTY_HEAT_MAP_COLORS.map((color, index) => ({
    color,
    value: minimum + (interval * index),
  }));
}
