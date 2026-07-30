import type { ExplorePlaceBriefV1 } from "../explore-contract.ts";
import { REACH_NOT_CALCULATED } from "./scenario.ts";
import type { ScenarioOutput } from "./types.ts";

export const FUNDER_SNAPSHOT_VERSION = "explore.funder-snapshot.v1" as const;

export type FunderEvidenceSnapshot = {
  contractVersion: typeof FUNDER_SNAPSHOT_VERSION;
  releaseStatus: "review_only";
  generatedAt: string;
  evidenceSnapshotId: string;
  place: { displayName: string; geoid: string; geography: "county" };
  countyContext: string[];
  evidenceSupportedNeed: Array<{
    observationId: string;
    statement: string;
    direction: string;
    citationIds: string[];
  }>;
  verifiedPlanningAlignment: string[];
  evidenceGaps: string[];
  proposedResponse: {
    name: string;
    status: string;
    explanation: string;
    evidenceIds: string[];
    requiresHumanReview: true;
  };
  geographicReach: {
    status: "calculated_range" | "not_calculated";
    statement: string;
    assumptions: ScenarioOutput["inputs"]["assumptions"];
  };
  partnerRequirements: string[];
  workforceRequirements: string[];
  measurementPlan: string[];
  sourceFreshness: ExplorePlaceBriefV1["publicData"]["sources"];
  citations: ExplorePlaceBriefV1["citations"];
  humanReviewStatus: "not_reviewed" | "review_requested" | "verified" | "rejected";
  disclosures: string[];
};

export function buildFunderEvidenceSnapshot(input: {
  brief: ExplorePlaceBriefV1;
  scenario: ScenarioOutput | null;
  generatedAt: string;
}): FunderEvidenceSnapshot {
  const selected = input.brief.resolution.selected;
  if (!selected || selected.kind !== "county") {
    throw new Error("A funder evidence snapshot requires one selected county.");
  }
  const supportedNeed = input.brief.publicData.observations
    .filter((observation) => observation.interpretation === "adverse_signal")
    .slice(0, 5)
    .map((observation) => ({
      observationId: observation.id,
      statement: `${observation.label}: ${observation.value}${observation.unit === "percent" ? "%" : ` ${observation.unit}`}.`,
      direction: observation.direction,
      citationIds: observation.citationIds,
    }));
  const response = input.brief.evidenceAssessment.responseFits.find((fit) => (
    fit.status === "fit_for_local_review"
  )) ?? input.brief.evidenceAssessment.responseFits.find((fit) => (
    fit.response === "no_recommendation_yet"
  )) ?? {
    response: "no_recommendation_yet" as const,
    status: "insufficient_evidence" as const,
    explanation: "No response is supported until the evidence gaps are reviewed locally.",
    evidenceIds: [],
    missingEvidence: input.brief.evidenceAssessment.missing,
    requiresHumanReview: true as const,
  };
  const participation = input.scenario?.range.participation;

  return {
    contractVersion: FUNDER_SNAPSHOT_VERSION,
    releaseStatus: "review_only",
    generatedAt: input.generatedAt,
    evidenceSnapshotId: input.brief.evidenceSnapshotId,
    place: {
      displayName: selected.displayName,
      geoid: selected.authorityId,
      geography: "county",
    },
    countyContext: input.brief.evidenceAssessment.known,
    evidenceSupportedNeed: supportedNeed,
    verifiedPlanningAlignment: input.brief.localPlanningEvidence.claims
      .filter((claim) => claim.reviewStatus === "verified")
      .map((claim) => claim.statement),
    evidenceGaps: [
      ...input.brief.evidenceAssessment.missing,
      ...response.missingEvidence,
    ].filter((value, index, values) => values.indexOf(value) === index),
    proposedResponse: {
      name: response.response,
      status: response.status,
      explanation: response.explanation,
      evidenceIds: response.evidenceIds,
      requiresHumanReview: true,
    },
    geographicReach: participation
      ? {
          status: "calculated_range",
          statement: `${participation.low}–${participation.high} ${participation.unit.replaceAll("_", " ")} under the recorded planning assumptions.`,
          assumptions: input.scenario?.inputs.assumptions ?? [],
        }
      : {
          status: "not_calculated",
          statement: REACH_NOT_CALCULATED,
          assumptions: input.scenario?.inputs.assumptions ?? [],
        },
    partnerRequirements: [
      "A named local owner for each accepted planning question.",
      "Verified resource and partner coverage before implementation.",
      "Licensed professionals retain responsibility for all clinical services.",
    ],
    workforceRequirements: [
      "Local confirmation of staffing and role availability.",
      "Credentialing and licensing remain with the responsible institutions.",
    ],
    measurementPlan: input.scenario?.measurementPlan ?? [
      "Agree on a baseline, owner, geography and reporting period before action.",
      "Track non-clinical readiness and accepted handoffs without collecting clinical information.",
      "Review evidence coverage and source freshness at each planning cycle.",
    ],
    sourceFreshness: input.brief.publicData.sources,
    citations: input.brief.citations,
    humanReviewStatus: input.scenario?.humanReviewStatus ?? "not_reviewed",
    disclosures: [
      "This review-only snapshot supports partnership discussion. It does not authorize an intervention or promise an outcome.",
      "Statistical observations and verified local planning priorities are separate evidence types.",
      "County evidence does not describe ZIP, city, neighborhood, household or individual conditions.",
      ...input.brief.safety.limitations,
    ],
  };
}
