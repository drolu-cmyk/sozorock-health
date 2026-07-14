import type {
  BarrierIndicators,
  BenchmarkProfile,
  ConditionIndicators,
  CountyPlanningRecord,
  GeographyProfile,
  MetricDefinition,
  MetricKey,
  PlanningMetrics,
  PreventionIndicators,
} from "./types";

export const conditionMetrics: MetricDefinition[] = [
  { key: "highBloodPressure", label: "High blood pressure", shortLabel: "Blood pressure", group: "condition", unit: "percent", direction: "higher-is-more-need", description: "Model-based crude prevalence among adults." },
  { key: "diabetes", label: "Diagnosed diabetes", shortLabel: "Diabetes", group: "condition", unit: "percent", direction: "higher-is-more-need", description: "Model-based crude prevalence among adults." },
  { key: "coronaryHeartDisease", label: "Coronary heart disease", shortLabel: "Heart disease", group: "condition", unit: "percent", direction: "higher-is-more-need", description: "Model-based crude prevalence among adults." },
  { key: "stroke", label: "Stroke", shortLabel: "Stroke", group: "condition", unit: "percent", direction: "higher-is-more-need", description: "Model-based crude prevalence among adults." },
  { key: "cancer", label: "Cancer (excluding skin cancer)", shortLabel: "Cancer", group: "condition", unit: "percent", direction: "higher-is-more-need", description: "Model-based crude prevalence among adults." },
  { key: "asthma", label: "Current asthma", shortLabel: "Asthma", group: "condition", unit: "percent", direction: "higher-is-more-need", description: "Model-based crude prevalence among adults." },
  { key: "copd", label: "Chronic obstructive pulmonary disease", shortLabel: "COPD", group: "condition", unit: "percent", direction: "higher-is-more-need", description: "Model-based crude prevalence among adults." },
  { key: "depression", label: "Depression", shortLabel: "Depression", group: "condition", unit: "percent", direction: "higher-is-more-need", description: "Model-based crude prevalence among adults." },
  { key: "obesity", label: "Obesity", shortLabel: "Obesity", group: "condition", unit: "percent", direction: "higher-is-more-need", description: "Model-based crude prevalence among adults." },
];

export const barrierMetrics: MetricDefinition[] = [
  { key: "uninsured", label: "Adults without health insurance", shortLabel: "Uninsured", group: "barrier", unit: "percent", direction: "higher-is-more-need", description: "Adults ages 18-64 without current health insurance." },
  { key: "transportation", label: "Lack of reliable transportation", shortLabel: "Transportation", group: "barrier", unit: "percent", direction: "higher-is-more-need", description: "Adults reporting a lack of reliable transportation." },
  { key: "foodInsecurity", label: "Food insecurity", shortLabel: "Food insecurity", group: "barrier", unit: "percent", direction: "higher-is-more-need", description: "Adults reporting food insecurity." },
  { key: "housingInsecurity", label: "Housing insecurity", shortLabel: "Housing insecurity", group: "barrier", unit: "percent", direction: "higher-is-more-need", description: "Adults reporting housing insecurity." },
  { key: "utilityShutoff", label: "Utility shutoff threat", shortLabel: "Utility pressure", group: "barrier", unit: "percent", direction: "higher-is-more-need", description: "Adults reporting a utility shutoff or threat." },
  { key: "loneliness", label: "Loneliness", shortLabel: "Loneliness", group: "barrier", unit: "percent", direction: "higher-is-more-need", description: "Adults reporting loneliness." },
  { key: "disability", label: "Disability and accessibility context", shortLabel: "Accessibility context", group: "barrier", unit: "percent", direction: "neutral", description: "Adults reporting any disability. This measure informs accommodation planning and is not classified as a barrier." },
];

/** Measures that can support pathway-barrier comparisons. Neutral context is excluded. */
export const planningBarrierMetrics = barrierMetrics.filter(
  (metric) => metric.direction === "higher-is-more-need",
);

export const preventionMetrics: MetricDefinition[] = [
  { key: "annualCheckup", label: "Routine annual checkup", shortLabel: "Annual checkup", group: "prevention", unit: "percent", direction: "higher-is-more-service", description: "Adults reporting a routine checkup in the past year." },
  { key: "dentalVisit", label: "Dental visit", shortLabel: "Dental visit", group: "prevention", unit: "percent", direction: "higher-is-more-service", description: "Adults reporting a dental visit in the past year." },
  { key: "cholesterolScreening", label: "Cholesterol screening", shortLabel: "Cholesterol", group: "prevention", unit: "percent", direction: "higher-is-more-service", description: "Adults meeting the PLACES cholesterol-screening measure." },
  { key: "colorectalScreening", label: "Colorectal cancer screening", shortLabel: "Colorectal", group: "prevention", unit: "percent", direction: "higher-is-more-service", description: "Eligible adults meeting the PLACES colorectal-screening measure." },
  { key: "mammography", label: "Mammography use", shortLabel: "Mammography", group: "prevention", unit: "percent", direction: "higher-is-more-service", description: "Eligible adults meeting the PLACES mammography-use measure." },
];

export const planningMetrics: MetricDefinition[] = [
  { key: "planningPressure", label: "Planning attention", shortLabel: "Planning attention", group: "planning", unit: "percentile", direction: "higher-is-more-need", description: "CB-CAP demonstration planning view; not a government designation, health-equity score, or clinical measure." },
  { key: "chronicPercentile", label: "Chronic-condition pressure", shortLabel: "Chronic pressure", group: "planning", unit: "percentile", direction: "higher-is-more-need", description: "County percentile across available chronic-condition estimates." },
  { key: "barrierPercentile", label: "Barrier pressure", shortLabel: "Barrier pressure", group: "planning", unit: "percentile", direction: "higher-is-more-need", description: "County percentile across available barrier estimates." },
  { key: "preventionOpportunityPercentile", label: "Prevention opportunity", shortLabel: "Prevention opportunity", group: "planning", unit: "percentile", direction: "higher-is-more-need", description: "County percentile across gaps in available preventive-service estimates." },
];

export const allMetrics = [
  ...conditionMetrics,
  ...barrierMetrics,
  ...preventionMetrics,
  ...planningMetrics,
];

export const metricByKey = new Map(allMetrics.map((metric) => [metric.key, metric]));

export function formatOrdinal(value: number | null) {
  if (value === null) return "Not available";
  const rounded = Math.round(value);
  const remainder = rounded % 100;
  if (remainder >= 11 && remainder <= 13) return `${rounded}th`;
  if (rounded % 10 === 1) return `${rounded}st`;
  if (rounded % 10 === 2) return `${rounded}nd`;
  if (rounded % 10 === 3) return `${rounded}rd`;
  return `${rounded}th`;
}

export function indicatorValue(
  profile: CountyPlanningRecord | GeographyProfile,
  key: MetricKey,
): number | null {
  if (key === "population") return profile.population;
  if (key === "dataCoverage") return profile.dataCoverage;
  if (key in profile.conditions) {
    return profile.conditions[key as keyof ConditionIndicators].value;
  }
  if (key in profile.barriers) {
    return profile.barriers[key as keyof BarrierIndicators].value;
  }
  if (key in profile.prevention) {
    return profile.prevention[key as keyof PreventionIndicators].value;
  }
  if (key in profile.planning) {
    return profile.planning[key as keyof PlanningMetrics];
  }
  return null;
}

export function displayedBenchmarkComparison(
  profile: CountyPlanningRecord | GeographyProfile,
  benchmark: BenchmarkProfile,
  metrics: MetricDefinition[],
) {
  for (const metric of metrics) {
    const value = indicatorValue(profile, metric.key);
    const benchmarkValue = metric.group === "condition"
      ? benchmark.conditions[metric.key as keyof ConditionIndicators]
      : metric.group === "barrier"
        ? benchmark.barriers[metric.key as keyof BarrierIndicators]
        : null;
    if (value !== null && benchmarkValue !== null) {
      return { metric, value, benchmarkValue, gap: value - benchmarkValue };
    }
  }
  return null;
}

export function formatMetric(value: number | null, key: MetricKey) {
  if (value === null) return "Not available";
  if (key === "population") return Math.round(value).toLocaleString("en-US");
  if (key === "dataCoverage") return `${Math.round(value)}%`;
  if (metricByKey.get(key)?.unit === "percentile") return formatOrdinal(value);
  return `${value.toFixed(1)}%`;
}

export function metricInterval(
  profile: CountyPlanningRecord | GeographyProfile,
  key: MetricKey,
) {
  if (key in profile.conditions) {
    return profile.conditions[key as keyof ConditionIndicators].ci;
  }
  if (key in profile.barriers) {
    return profile.barriers[key as keyof BarrierIndicators].ci;
  }
  if (key in profile.prevention) {
    return profile.prevention[key as keyof PreventionIndicators].ci;
  }
  return null;
}
