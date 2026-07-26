import type {
  CaseForActionPackage,
  DecisionSupportPlanningClaim,
  DecisionSupportSignal,
  PublicCaseForAction,
} from "./types.ts";

function unique(values: string[]) {
  return [...new Set(values)];
}

export function isConcernSignal(signal: DecisionSupportSignal) {
  if (signal.reviewStatus !== "verified") return false;
  if (signal.interpretation !== "adverse_signal") return false;
  if (signal.direction === "protective") return signal.difference < 0;
  if (signal.direction === "adverse") return signal.difference > 0;
  return false;
}

export function publicCaseForAction(value: CaseForActionPackage): PublicCaseForAction {
  const { internalReview: _internalReview, ...publicValue } = value;
  void _internalReview;
  return publicValue;
}

export function publishablePlanningClaims(
  value: CaseForActionPackage,
): DecisionSupportPlanningClaim[] {
  const verifiedCurrentDocumentIds = new Set(
    value.localPlan.documents
      .filter((document) => (
        document.coverage === "county_specific"
        && document.currentPlanStatus === "verified_current"
        && document.reviewStatus === "verified"
      ))
      .map((document) => document.id),
  );
  return value.internalReview.claimsAwaitingReview.filter((claim) => (
    claim.reviewStatus === "verified" && verifiedCurrentDocumentIds.has(claim.documentId)
  ));
}

export function validateCaseForAction(value: CaseForActionPackage) {
  const errors: string[] = [];
  if (value.releaseStatus !== "review_only") errors.push("Milestone 6 packages must remain review-only.");
  if (!value.editable) errors.push("The evidence brief must remain editable.");
  if (value.place.kind !== "county" || value.place.fips.length !== 5) errors.push("A reviewed five-digit county FIPS is required.");

  const sourceIds = new Set(value.sources.map((source) => source.id));
  for (const signal of value.publicData.signals) {
    if (signal.geographyId !== value.place.geographyId || signal.geographyLevel !== "county") {
      errors.push(`${signal.id} does not match the selected county geography.`);
    }
    if (!sourceIds.has(signal.sourceId)) errors.push(`${signal.id} has no source-ledger record.`);
    if (!signal.sourceRecordId) errors.push(`${signal.id} is missing its original source-record locator.`);
    if (!signal.releaseDate || !signal.dataPeriod || !signal.retrievedAt) errors.push(`${signal.id} is missing source dates.`);
    if (signal.direction === "protective" && signal.difference > 0 && signal.interpretation === "adverse_signal") {
      errors.push(`${signal.id} incorrectly treats a favorable higher value as an adverse signal.`);
    }
  }

  if (value.localPlan.verifiedAlignment.length > 0 && publishablePlanningClaims(value).length === 0) {
    errors.push("Verified local-plan alignment requires a verified current county document and verified claim citation.");
  }
  if (value.resourceCoverage.resources.some((resource) => resource.reviewStatus !== "verified")) {
    errors.push("Public resource coverage may contain only verified records.");
  }
  if (value.responseConcept.status === "potentially supported" && !value.practicalBarriers.length) {
    errors.push("A potentially supported response requires at least one sourced practical barrier.");
  }
  return unique(errors);
}
