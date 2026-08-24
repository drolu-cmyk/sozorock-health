import type { MeasureDefinition } from "./contracts.ts";
import {
  buildEvidenceGatewayResponseV1,
  type BuildEvidenceGatewayInput,
  type EvidenceGatewayResponseV1,
  type MetricSemanticPolicy,
} from "./evidence-gateway.ts";

const CROSS_SECTIONAL_AREA_VIEWS = [
  "choropleth",
  "ranked_dot",
  "distribution",
  "uncertainty_interval",
] as const;

const CROSS_SECTIONAL_BARRIER_RELATIONSHIP_VIEWS = [
  ...CROSS_SECTIONAL_AREA_VIEWS,
  "scatterplot",
  "bivariate_map",
  "barrier_matrix",
  "service_gap",
] as const;

const CONTEXTUAL_DESIGNATION_VIEWS = [
  "designation_overlay",
  "service_gap",
] as const;

const ADVERSE_BARRIER_MEASURES = new Set([
  "ACCESS2:Crude",
  "LACKTRPT:Crude",
  "FOODINSECU:Crude",
  "HOUSINSECU:Crude",
  "SHUTUTILITY:Crude",
  "LONELINESS:Crude",
]);

const ACCESSIBILITY_CONTEXT_MEASURES = new Set([
  "DISABILITY:Crude",
]);

const OFFICIAL_DESIGNATION_MEASURES = new Set([
  "HPSA_DESIGNATION",
  "MUA_P_DESIGNATION",
]);

const CONDITION_MEASURES = new Set([
  "BPHIGH:Crude",
  "DIABETES:Crude",
  "CHD:Crude",
  "STROKE:Crude",
  "CANCER:Crude",
  "CASTHMA:Crude",
  "COPD:Crude",
  "DEPRESSION:Crude",
  "OBESITY:Crude",
]);

const PREVENTION_MEASURES = new Set([
  "CHECKUP:Crude",
  "DENTAL:Crude",
  "CHOLSCREEN:Crude",
  "COLON_SCREEN:Crude",
  "MAMMOUSE:Crude",
]);

export const SAFE_UNCURATED_METRIC_POLICY: MetricSemanticPolicy = {
  trendable: false,
  forecastable: false,
  aggregatable: false,
  allowedGeographyKinds: [],
  allowedVisualizations: [],
};

function countyCrossSectionalPolicy(
  allowedVisualizations: readonly string[],
): MetricSemanticPolicy {
  return {
    trendable: false,
    forecastable: false,
    aggregatable: false,
    allowedGeographyKinds: ["county"],
    allowedVisualizations: [...allowedVisualizations],
  };
}

/**
 * Curate autonomous analytical permissions from the stable source measure ID.
 *
 * The registry is intentionally conservative. A new source measure receives no
 * trend, forecast, aggregation, geography, or visualization permission until a
 * reviewer adds an explicit policy here or supplies an override to the gateway.
 */
export function metricSemanticPolicyFor(
  definition: MeasureDefinition,
): MetricSemanticPolicy {
  const sourceMeasureId = definition.sourceMeasureId;

  if (ADVERSE_BARRIER_MEASURES.has(sourceMeasureId)) {
    if (
      definition.direction !== "adverse"
      || definition.higherValueMeaning !== "adverse"
      || definition.comparisonPolicy !== "higher_is_concern"
    ) {
      return SAFE_UNCURATED_METRIC_POLICY;
    }
    return countyCrossSectionalPolicy(CROSS_SECTIONAL_BARRIER_RELATIONSHIP_VIEWS);
  }

  if (ACCESSIBILITY_CONTEXT_MEASURES.has(sourceMeasureId)) {
    if (
      definition.direction !== "contextual"
      || definition.comparisonPolicy !== "context_only"
    ) {
      return SAFE_UNCURATED_METRIC_POLICY;
    }
    return countyCrossSectionalPolicy(CROSS_SECTIONAL_AREA_VIEWS);
  }

  if (OFFICIAL_DESIGNATION_MEASURES.has(sourceMeasureId)) {
    if (
      definition.direction !== "contextual"
      || definition.higherValueMeaning !== "context_dependent"
      || definition.comparisonPolicy !== "context_only"
    ) {
      return SAFE_UNCURATED_METRIC_POLICY;
    }
    return countyCrossSectionalPolicy(CONTEXTUAL_DESIGNATION_VIEWS);
  }

  if (CONDITION_MEASURES.has(sourceMeasureId) || PREVENTION_MEASURES.has(sourceMeasureId)) {
    return countyCrossSectionalPolicy(CROSS_SECTIONAL_AREA_VIEWS);
  }

  return SAFE_UNCURATED_METRIC_POLICY;
}

export function buildMetricSemanticPolicies(
  definitions: MeasureDefinition[],
): Record<string, MetricSemanticPolicy> {
  return Object.fromEntries(
    definitions.map((definition) => [definition.id, metricSemanticPolicyFor(definition)]),
  );
}

export type CuratedEvidenceGatewayInput = Omit<BuildEvidenceGatewayInput, "metricPolicies"> & {
  metricPolicies?: Record<string, MetricSemanticPolicy>;
};

/**
 * Build a CB-CAP-ready public evidence package using reviewed semantic policy.
 *
 * Explicit caller overrides may narrow or extend a reviewed definition, but an
 * unrecognized measure remains fail-closed through SAFE_UNCURATED_METRIC_POLICY.
 */
export function buildCuratedEvidenceGatewayResponseV1(
  input: CuratedEvidenceGatewayInput,
): EvidenceGatewayResponseV1 {
  const reviewedPolicies = buildMetricSemanticPolicies(input.measureDefinitions);
  return buildEvidenceGatewayResponseV1({
    ...input,
    metricPolicies: {
      ...reviewedPolicies,
      ...(input.metricPolicies ?? {}),
    },
  });
}
