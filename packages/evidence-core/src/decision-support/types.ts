import type { ReviewStatus } from "../contracts.ts";
import type { ResponseFitStatus, ResponseType } from "../agent/types.ts";

export const CASE_FOR_ACTION_SCHEMA_VERSION = "case-for-action.v1" as const;

export type DecisionSupportSignal = {
  id: string;
  label: string;
  definition: string;
  category: "chronic_condition" | "practical_barrier" | "preventive_service" | "context";
  localValue: number;
  comparisonValue: number;
  unit: "percent";
  comparisonLabel: string;
  difference: number;
  direction: "adverse" | "protective" | "contextual";
  interpretation: "adverse_signal" | "favorable_signal" | "context_only" | "similar";
  confidenceInterval: string | null;
  geographyId: string;
  geographyLevel: "county";
  sourceId: string;
  sourceVersionId: string;
  sourceRecordId: string;
  releaseDate: string;
  dataPeriod: string;
  retrievedAt: string;
  reviewStatus: ReviewStatus;
};

export type DecisionSupportSource = {
  id: string;
  publisher: string;
  title: string;
  officialUrl: string;
  releaseDate: string;
  dataPeriod: string;
  retrievedAt: string;
  geography: string;
  reviewStatus: ReviewStatus;
  use: "geography" | "public_data" | "local_plan" | "resource";
};

export type DecisionSupportPlanningDocument = {
  id: string;
  title: string;
  publisher: string;
  officialUrl: string;
  publicationDate: string;
  planCycle: string | null;
  coverage: "county_specific" | "regional" | "hospital_specific" | "state_level";
  currentPlanStatus: "verified_current" | "not_yet_verified" | "superseded" | "not_applicable";
  reviewStatus: ReviewStatus;
};

export type DecisionSupportPlanningClaim = {
  id: string;
  documentId: string;
  type: "priority" | "finding" | "disparity" | "barrier" | "objective" | "intervention" | "evaluation_measure";
  statement: string;
  exactExcerpt: string;
  page: number;
  section: string;
  reviewStatus: ReviewStatus;
};

export type DecisionSupportResource = {
  id: string;
  name: string;
  type: string;
  coverage: string;
  sourceId: string;
  reviewStatus: ReviewStatus;
};

export type ProposedProgressMeasure = {
  id: string;
  label: string;
  definition: string;
  status: "proposed_for_partner_review";
};

export type CaseForActionPackage = {
  id: string;
  schemaVersion: typeof CASE_FOR_ACTION_SCHEMA_VERSION;
  releaseStatus: "review_only";
  generatedAt: string;
  editable: true;
  place: {
    geographyId: string;
    kind: "county";
    fips: string;
    displayName: string;
    state: string;
    population: number;
    geographyCaveat: string;
  };
  executiveSummary: string;
  evidenceStatus: {
    localPlan: "verified" | "not_yet_verified";
    publicData: "verified" | "stale" | "unavailable";
    resourceCoverage: "verified" | "no_verified_records";
  };
  localPlan: {
    publicStatement: string;
    verifiedAlignment: string[];
    documents: DecisionSupportPlanningDocument[];
  };
  publicData: {
    publicStatement: string;
    signals: DecisionSupportSignal[];
  };
  practicalBarriers: Array<{
    title: string;
    statement: string;
    signalId: string;
  }>;
  resourceCoverage: {
    publicStatement: string;
    resources: DecisionSupportResource[];
  };
  responseConcept: {
    responseType: ResponseType | null;
    status: ResponseFitStatus;
    title: string;
    summary: string;
    pathway: Array<{
      stage: "Evidence" | "Practical barrier" | "Potential response" | "Partner role" | "Measure of progress";
      statement: string;
      status: "verified" | "proposed_for_partner_review" | "missing";
    }>;
  };
  progressMeasures: ProposedProgressMeasure[];
  evidenceGaps: string[];
  sources: DecisionSupportSource[];
  disclosures: string[];
  internalReview: {
    summary: string;
    claimsAwaitingReview: DecisionSupportPlanningClaim[];
    decisionsRequired: string[];
  };
};

export type PublicCaseForAction = Omit<CaseForActionPackage, "internalReview">;
