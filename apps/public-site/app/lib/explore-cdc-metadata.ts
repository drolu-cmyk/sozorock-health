import { deterministicUuid, type ExploreObservation } from "@sozorock/evidence-core";

/**
 * CDC PLACES observation metadata is keyed by the reviewed measure definition,
 * not by the human-facing label rendered in Explore. Keeping this lookup in
 * one place prevents labels such as "COPD" from being confused with source
 * labels or translated copy.
 */
export function cdcMeasureDefinitionId(sourceMeasureId: string, adjustment = "Crude") {
  return deterministicUuid("measure", "cdc-places", `${sourceMeasureId}:${adjustment}`);
}
export function indexCdcObservations(
  observations: readonly ExploreObservation[],
  sourceVersionId: string | null | undefined,
) {
  const index = new Map<string, ExploreObservation>();
  if (!sourceVersionId) return index;
  for (const observation of observations) {
    if (observation.sourceVersionId !== sourceVersionId) continue;
    index.set(observation.measureDefinitionId, observation);
  }
  return index;
}
