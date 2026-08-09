export type ComparisonInterpretation =
  | "adverse_signal"
  | "favorable_signal"
  | "context_only"
  | "equal"
  | "comparison_unavailable";

export type ComparisonBasis = "state" | "national";

export type MetricComparison = {
  basis: ComparisonBasis;
  value: number | null;
  difference: number | null;
  interpretation: ComparisonInterpretation;
  sentence: string;
};

export type MetricComparisons = {
  state: MetricComparison;
  national: MetricComparison;
  displayedBasis: ComparisonBasis | "unavailable";
};

type HigherValueMeaning = "adverse" | "favorable" | "context_dependent";

export function roundComparisonDifference(value: number) {
  const rounded = Number(value.toFixed(1));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function comparisonInterpretation(
  higherValueMeaning: HigherValueMeaning,
  difference: number | null,
): ComparisonInterpretation {
  if (difference === null) return "comparison_unavailable";
  if (higherValueMeaning === "context_dependent") return "context_only";
  if (Math.abs(difference) < 2) return "equal";
  return higherValueMeaning === "adverse"
    ? difference > 0 ? "adverse_signal" : "favorable_signal"
    : difference < 0 ? "adverse_signal" : "favorable_signal";
}

export function buildMetricComparison(input: {
  localValue: number;
  benchmarkValue: number | null;
  basis: ComparisonBasis;
  higherValueMeaning: HigherValueMeaning;
}): MetricComparison {
  const difference = input.benchmarkValue === null
    ? null
    : roundComparisonDifference(input.localValue - input.benchmarkValue);
  const label = input.basis === "state" ? "state comparison" : "national comparison";
  return {
    basis: input.basis,
    value: input.benchmarkValue,
    difference,
    interpretation: comparisonInterpretation(input.higherValueMeaning, difference),
    sentence: difference === null
      ? `${input.basis === "state" ? "State" : "National"} comparison unavailable for this release.`
      : difference === 0
        ? `No percentage-point difference from the ${label} after rounding.`
        : `${Math.abs(difference).toFixed(1)} percentage points ${difference > 0 ? "above" : "below"} the ${label}.`,
  };
}

export function buildMetricComparisons(input: {
  localValue: number;
  stateValue: number | null;
  nationalValue: number | null;
  higherValueMeaning: HigherValueMeaning;
}): MetricComparisons {
  const state = buildMetricComparison({
    localValue: input.localValue,
    benchmarkValue: input.stateValue,
    basis: "state",
    higherValueMeaning: input.higherValueMeaning,
  });
  const national = buildMetricComparison({
    localValue: input.localValue,
    benchmarkValue: input.nationalValue,
    basis: "national",
    higherValueMeaning: input.higherValueMeaning,
  });
  return {
    state,
    national,
    displayedBasis: state.value !== null ? "state" : national.value !== null ? "national" : "unavailable",
  };
}

export function displayedComparison(comparisons: MetricComparisons) {
  return comparisons.displayedBasis === "state"
    ? comparisons.state
    : comparisons.displayedBasis === "national"
      ? comparisons.national
      : null;
}
