import type {
  EvidenceCitation,
  EvidenceClaim,
  Geography,
  MeasureDefinition,
  MetricObservation,
  SourceVersion,
} from "../contracts.ts";

export const OPERATIONAL_DOMAINS = [
  "data_freshness",
  "source_resilience",
  "geography_integrity",
  "evidence_governance",
  "public_delivery",
  "accessibility",
  "performance",
  "security_privacy",
  "agent_safety",
  "human_review",
  "cost_control",
] as const;

export type OperationalDomain = (typeof OPERATIONAL_DOMAINS)[number];
export type OperationalGateStatus = "pass" | "warning" | "fail" | "not_run";

export type OperationalControl = {
  id: string;
  domain: OperationalDomain;
  title: string;
  status: OperationalGateStatus;
  releaseBlocking: boolean;
  evidence: string[];
  requiredAction: string | null;
};

export type SourceFreshnessAssessment = {
  status: "current" | "stale" | "unavailable";
  ageDays: number | null;
  staleAfterDays: number;
  label: string;
};

export type PublicEvidenceEligibility = {
  eligible: boolean;
  reasons: string[];
};

export type PrioritySignal = {
  observation: MetricObservation;
  measure: MeasureDefinition;
  magnitude: number;
};

export type PublicationCheckInput = {
  selectedGeography: Geography;
  observation: MetricObservation;
  measure: MeasureDefinition;
  sourceVersion: SourceVersion;
  now: string;
};

export type ClaimPublicationCheckInput = {
  claim: EvidenceClaim;
  citations: EvidenceCitation[];
};

export type PlaceAcceptanceResult = {
  place: string;
  countyFips: string;
  geographyResolved: boolean;
  publicDataStatus: "usable" | "limited" | "unavailable";
  localPlanStatus: "verified" | "awaiting_review" | "not_yet_verified";
  agentSafetyStatus: "pass" | "fail";
  publicReleaseStatus: "pass" | "conditional" | "blocked";
  limitations: string[];
};

export type NationalOperationsReport = {
  evaluatedAt: string;
  policyVersion: string;
  releaseRecommendation: "go" | "conditional_go" | "no_go";
  controls: OperationalControl[];
  places: PlaceAcceptanceResult[];
  blockingControlIds: string[];
};
