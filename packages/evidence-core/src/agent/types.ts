import type {
  EvidenceCitation,
  EvidenceClaim,
  Geography,
  GeographyKind,
  MeasureDefinition,
  MetricObservation,
  PlanningDocument,
  ReviewStatus,
  SourceCatalogRecord,
  SourceVersion,
} from "../contracts.ts";
import type { GeographyCatalog } from "../geography.ts";

export const PLACE_AGENT_POLICY_VERSION = "place-evidence-agent.v1" as const;

export const RESPONSE_FIT_STATUSES = [
  "potentially supported",
  "insufficient evidence",
  "requires local partner review",
  "not appropriate based on available evidence",
] as const;

export type ResponseFitStatus = (typeof RESPONSE_FIT_STATUSES)[number];

export const RESPONSE_TYPES = [
  "health_equity_hub",
  "health_access_day",
  "provider_led_pathway",
  "workforce_conversation",
] as const;

export type ResponseType = (typeof RESPONSE_TYPES)[number];

export type AgentConfidence = {
  level: "high" | "moderate" | "low";
  rationale: string;
};

export type AgentGeographicScope = {
  geographyId: string | null;
  kind: GeographyKind | null;
  displayName: string | null;
  authority: string | null;
  authorityId: string | null;
  evidenceGeographyIds: string[];
};

export type AgentCitation = {
  id: string;
  evidenceId: string;
  evidenceType: "geography" | "metric_observation" | "planning_claim" | "planning_document";
  sourceId: string;
  sourceVersionId: string;
  publisher: string;
  title: string;
  officialUrl: string;
  releaseDate: string;
  dataPeriodStart: string | null;
  dataPeriodEnd: string | null;
  retrievedAt: string;
  geographyId: string;
  geographyKind: GeographyKind;
  geographyName: string;
  locator: {
    sourceRecordId: string | null;
    pageNumber: number | null;
    section: string | null;
  };
  reviewStatus: ReviewStatus;
  freshness: "current" | "stale";
};

export type GroundedToolStatus = "ok" | "insufficient_evidence" | "refused" | "not_found" | "ambiguous";

export type GroundedToolResult<T> = {
  tool: PlaceAgentToolName;
  status: GroundedToolStatus;
  answer: string;
  data: T;
  citedEvidence: AgentCitation[];
  sourceAndDataDates: Array<{
    sourceVersionId: string;
    releaseDate: string;
    dataPeriodStart: string | null;
    dataPeriodEnd: string | null;
    retrievedAt: string;
    freshness: "current" | "stale";
  }>;
  geographicScope: AgentGeographicScope;
  confidence: AgentConfidence;
  missingEvidence: string[];
  caveats: string[];
  nonClinicalBoundary: string;
  generatedAt: string;
  policyVersion: typeof PLACE_AGENT_POLICY_VERSION;
};

export type PlaceEvidenceSnapshot = {
  snapshotId: string;
  createdAt: string;
  geographyCatalog: GeographyCatalog;
  geographySourceVersionByGeographyId: Record<string, string>;
  sourceCatalog: SourceCatalogRecord[];
  sourceVersions: SourceVersion[];
  measureDefinitions: MeasureDefinition[];
  observations: MetricObservation[];
  planningDocuments: PlanningDocument[];
  claims: EvidenceClaim[];
  citations: EvidenceCitation[];
};

export type PlaceAgentRepository = {
  getSnapshotId(): string;
  getCatalog(): GeographyCatalog;
  getGeography(id: string): Geography | null;
  getGeographySourceVersionId(id: string): string | null;
  getSourceCatalog(id: string): SourceCatalogRecord | null;
  getSourceVersion(id: string): SourceVersion | null;
  getMeasureDefinition(id: string): MeasureDefinition | null;
  listObservations(geographyId: string): MetricObservation[];
  listPlanningDocuments(geographyId: string): PlanningDocument[];
  listClaims(documentIds: string[]): EvidenceClaim[];
  listCitations(claimIds: string[]): EvidenceCitation[];
};

export type ResolvePlaceInput = {
  query: string;
  queryKind: "zip_input" | "zcta" | "place" | "county_fips" | "state" | "planning_region";
  stateHint: string | null;
};

export type GetPlaceEvidenceInput = {
  geographyId: string;
  measureIds: string[] | null;
  includeStale: boolean;
};

export type GetLocalPlanInput = {
  geographyId: string;
  documentTypes: Array<PlanningDocument["documentType"]> | null;
};

export type ComparePlacesInput = {
  geographyIds: string[];
  measureIds: string[];
};

export type AssessResponseFitInput = {
  geographyId: string;
  responseType: ResponseType;
};

export type DraftPartnerBriefInput = {
  geographyId: string;
  audience: "community_partner" | "county_or_state" | "funder" | "licensed_provider" | "education_or_workforce";
  responseType: ResponseType | null;
};

export type PlaceAgentToolName =
  | "resolve_place"
  | "get_place_evidence"
  | "get_local_plan"
  | "compare_places"
  | "assess_response_fit"
  | "draft_partner_brief";

export type PlaceAgentToolInputs = {
  resolve_place: ResolvePlaceInput;
  get_place_evidence: GetPlaceEvidenceInput;
  get_local_plan: GetLocalPlanInput;
  compare_places: ComparePlacesInput;
  assess_response_fit: AssessResponseFitInput;
  draft_partner_brief: DraftPartnerBriefInput;
};

export type PlaceAgentToolDefinition = {
  type: "function";
  name: PlaceAgentToolName;
  description: string;
  strict: true;
  parameters: Record<string, unknown>;
};

export type PlaceAgentQuestionInput = {
  selectedGeographyId: string;
  question: string;
};

export type PlaceAgentQuestionData = {
  intent: "place_evidence" | "local_plan" | "response_fit" | "partner_brief" | "safety_boundary";
  supportingTool: PlaceAgentToolName | null;
  responseFit: ResponseFitStatus | null;
};
