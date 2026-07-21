import type {
  GeographyKind,
  MetricDirection,
  ReviewStatus,
} from "./contracts.ts";

export const EXPLORE_PLACE_BRIEF_VERSION = "explore.place-brief.v1" as const;

export type ExploreGeographyReference = {
  id: string;
  kind: GeographyKind;
  authority: string;
  authorityId: string;
  displayName: string;
  vintage: string;
  reviewStatus: ReviewStatus;
};

export type ExploreSourceReference = {
  sourceId: string;
  sourceVersionId: string;
  publisher: string;
  title: string;
  officialUrl: string;
  releaseDate: string;
  dataPeriod: { start: string | null; end: string | null };
  retrievedAt: string;
  reviewStatus: ReviewStatus;
};

export type ExploreCitation = {
  id: string;
  sourceVersionId: string;
  documentId: string | null;
  officialUrl: string;
  pageNumber: number | null;
  section: string | null;
  sourceField: string | null;
  quotedText: string | null;
  reviewStatus: ReviewStatus;
};

export type ExploreObservation = {
  id: string;
  measureDefinitionId: string;
  label: string;
  direction: MetricDirection;
  unit: string;
  universe: string;
  adjustment: string;
  value: number | string | boolean | null;
  confidence: { low: number | null; high: number | null; marginOfError: number | null };
  geographyId: string;
  sourceVersionId: string;
  releaseDate: string;
  dataPeriod: { start: string | null; end: string | null };
  reviewStatus: ReviewStatus;
  interpretation: "adverse_signal" | "favorable_signal" | "context_only" | "not_rankable" | "missing" | "equal";
  benchmarkObservationId: string | null;
  citationIds: string[];
};

export type ExploreLocalClaim = {
  id: string;
  documentId: string;
  type: "priority" | "finding" | "barrier" | "asset" | "action" | "data_gap";
  statement: string;
  confidence: "high" | "moderate" | "low";
  reviewStatus: ReviewStatus;
  citationIds: string[];
};

export type ExploreResponseFit = {
  response: "health_equity_hub" | "health_access_day" | "provider_led_pathway" | "workforce_conversation" | "no_recommendation_yet";
  status: "fit_for_local_review" | "insufficient_evidence" | "not_applicable";
  explanation: string;
  evidenceIds: string[];
  missingEvidence: string[];
  requiresHumanReview: true;
};

export type ExplorePlaceBriefV1 = {
  contractVersion: typeof EXPLORE_PLACE_BRIEF_VERSION;
  generatedAt: string;
  evidenceSnapshotId: string;
  policyVersion: string;
  query: {
    raw: string;
    kind: "zip_input" | "zcta" | "place" | "county_fips" | "state" | "planning_region";
  };
  resolution: {
    status: "resolved" | "ambiguous" | "not_found" | "unsupported";
    selected: ExploreGeographyReference | null;
    evidenceGeographies: ExploreGeographyReference[];
    overlappingCounties: Array<ExploreGeographyReference & {
      overlapAreaPercent: number | null;
      overlapPopulationPercent: number | null;
    }>;
    caveats: string[];
  };
  localPlanningEvidence: {
    status: "verified" | "not_yet_verified" | "stale" | "unavailable";
    documents: Array<{
      id: string;
      type: "cha" | "chip" | "chna" | "csp" | "implementation_strategy" | "supporting_report";
      title: string;
      publisher: string;
      officialUrl: string;
      publishedAt: string | null;
      period: { start: string | null; end: string | null };
      reviewStatus: ReviewStatus;
    }>;
    claims: ExploreLocalClaim[];
  };
  publicData: {
    observations: ExploreObservation[];
    sources: ExploreSourceReference[];
  };
  evidenceAssessment: {
    known: string[];
    missing: string[];
    requiresLocalReview: string[];
    responseFits: ExploreResponseFit[];
  };
  citations: ExploreCitation[];
  safety: {
    classification: "non_clinical_place_evidence";
    containsPhi: false;
    limitations: string[];
  };
};

export function validateExplorePlaceBriefV1(brief: ExplorePlaceBriefV1) {
  const errors: string[] = [];
  if (brief.contractVersion !== EXPLORE_PLACE_BRIEF_VERSION) errors.push("Unsupported Explore contract version.");
  const citationIds = new Set(brief.citations.map((citation) => citation.id));
  const sourceVersionIds = new Set(brief.publicData.sources.map((source) => source.sourceVersionId));
  for (const observation of brief.publicData.observations) {
    if (!sourceVersionIds.has(observation.sourceVersionId)) errors.push(`Observation ${observation.id} has no source version reference.`);
    for (const citationId of observation.citationIds) {
      if (!citationIds.has(citationId)) errors.push(`Observation ${observation.id} cites missing citation ${citationId}.`);
    }
    if ((observation.direction === "contextual" || observation.direction === "unknown")
      && !["context_only", "not_rankable", "missing"].includes(observation.interpretation)) {
      errors.push(`Observation ${observation.id} has an invalid rankable interpretation for ${observation.direction} direction.`);
    }
  }
  for (const claim of brief.localPlanningEvidence.claims) {
    if (claim.citationIds.length === 0) errors.push(`Local claim ${claim.id} has no citation.`);
    for (const citationId of claim.citationIds) {
      if (!citationIds.has(citationId)) errors.push(`Local claim ${claim.id} cites missing citation ${citationId}.`);
    }
  }
  for (const response of brief.evidenceAssessment.responseFits) {
    if (!response.requiresHumanReview) errors.push(`Response ${response.response} must require human review.`);
    if (response.status === "fit_for_local_review" && response.evidenceIds.length === 0) {
      errors.push(`Response ${response.response} has no supporting evidence.`);
    }
  }
  if (brief.localPlanningEvidence.status === "verified"
    && brief.localPlanningEvidence.documents.every((document) => document.reviewStatus !== "verified")) {
    errors.push("Verified local planning status requires at least one verified document.");
  }
  return { valid: errors.length === 0, errors };
}
