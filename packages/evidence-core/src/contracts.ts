export const REVIEW_STATUSES = [
  "verified",
  "provisional",
  "stale",
  "unavailable",
  "rejected",
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const GEOGRAPHY_KINDS = [
  "state",
  "county",
  "census_place",
  "zcta",
  "postal_zip",
  "planning_region",
] as const;

export type GeographyKind = (typeof GEOGRAPHY_KINDS)[number];

export const GEOGRAPHY_RELATIONSHIP_KINDS = [
  "contains",
  "intersects",
  "overlaps",
  "approximates",
  "member_of",
  "plan_applies_to",
] as const;

export type GeographyRelationshipKind =
  (typeof GEOGRAPHY_RELATIONSHIP_KINDS)[number];

export const METRIC_DIRECTIONS = [
  "adverse",
  "protective",
  "contextual",
  "unknown",
] as const;

export type MetricDirection = (typeof METRIC_DIRECTIONS)[number];

export const HIGHER_VALUE_MEANINGS = [
  "favorable",
  "adverse",
  "neutral",
  "context_dependent",
] as const;

export type HigherValueMeaning = (typeof HIGHER_VALUE_MEANINGS)[number];

export const OBSERVATION_GEOGRAPHY_LEVELS = [
  ...GEOGRAPHY_KINDS,
  "census_tract",
  "county_subdivision",
  "population_group",
  "facility",
  "source_designation",
] as const;

export type ObservationGeographyLevel =
  (typeof OBSERVATION_GEOGRAPHY_LEVELS)[number];

export type Geography = {
  id: string;
  kind: GeographyKind;
  authority: "census" | "usps" | "state" | "local" | "regional";
  authorityId: string;
  name: string;
  displayName: string;
  stateFips: string | null;
  countyFips: string | null;
  vintage: string;
  validFrom: string | null;
  validTo: string | null;
  reviewStatus: ReviewStatus;
  caveat: string | null;
};

export type GeographyAlias = {
  id: string;
  geographyId: string;
  alias: string;
  aliasType: "official" | "postal" | "common" | "former" | "search";
  sourceVersionId: string;
  reviewStatus: ReviewStatus;
};

export type GeographyRelationship = {
  id: string;
  fromGeographyId: string;
  toGeographyId: string;
  kind: GeographyRelationshipKind;
  sourceVersionId: string;
  vintage: string;
  overlapAreaPercent: number | null;
  overlapPopulationPercent: number | null;
  method: string;
  caveat: string | null;
  reviewStatus: ReviewStatus;
};

export type PlaceQuery = {
  raw: string;
  kind: "zip_input" | "zcta" | "place" | "county_fips" | "state" | "planning_region";
  stateHint?: string;
};

export type PlaceResolution = {
  query: PlaceQuery;
  status: "resolved" | "ambiguous" | "not_found" | "unsupported";
  selected: Geography | null;
  alternatives: Geography[];
  evidenceGeography: Geography | null;
  relationships: GeographyRelationship[];
  caveats: string[];
};

export type SourceFamily =
  | "census_geography"
  | "cdc_places"
  | "acs"
  | "hrsa"
  | "ahrq_clh"
  | "local_planning_document";

export type SourceCatalogRecord = {
  id: string;
  family: SourceFamily;
  publisher: string;
  title: string;
  officialUrl: string;
  hostPolicy: "fixed_allowlist" | "reviewer_approved_per_document";
  allowedHosts: string[];
  refreshCadence: "annual" | "release_based" | "daily" | "monthly_review" | "manual";
  geographyKinds: GeographyKind[];
  reviewStatus: ReviewStatus;
  limitations: string[];
};

export type SourceVersion = {
  id: string;
  sourceId: string;
  releaseLabel: string;
  releaseDate: string;
  dataPeriodStart: string | null;
  dataPeriodEnd: string | null;
  retrievedAt: string;
  staleAfter: string;
  officialUrl: string;
  contentHash: string;
  schemaVersion: string;
  reviewStatus: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export type MeasureDefinition = {
  id: string;
  sourceMeasureId: string;
  name: string;
  description: string;
  direction: MetricDirection;
  higherValueMeaning: HigherValueMeaning;
  unit: "percent" | "count" | "rate" | "ratio" | "index" | "designation";
  universe: string;
  adjustment: "crude" | "age_adjusted" | "modeled" | "not_applicable";
  comparisonPolicy: "higher_is_concern" | "lower_is_concern" | "context_only" | "not_rankable";
  reviewStatus: ReviewStatus;
};

export type MetricObservation = {
  id: string;
  measureDefinitionId: string;
  geographyId: string;
  sourceVersionId: string;
  sourceRecordId: string;
  sourceUrl: string;
  geographyLevel: ObservationGeographyLevel;
  value: number | string | boolean | null;
  numericValue: number | null;
  confidenceLow: number | null;
  confidenceHigh: number | null;
  marginOfError: number | null;
  releaseDate: string;
  dataPeriodStart: string | null;
  dataPeriodEnd: string | null;
  retrievedAt: string;
  reviewStatus: ReviewStatus;
  suppressionReason: string | null;
  sourceMetadata: Record<string, string | number | boolean | null>;
};

export const SOURCE_IMPORT_STATUSES = [
  "running",
  "available",
  "stale",
  "unavailable",
  "failed",
] as const;

export type SourceImportStatus = (typeof SOURCE_IMPORT_STATUSES)[number];

export type SourceImportState = {
  id: string;
  adapterId: string;
  sourceId: string;
  sourceVersionId: string | null;
  idempotencyKey: string;
  status: SourceImportStatus;
  attemptedAt: string;
  successfulImportAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  sourceReleaseLabel: string | null;
  sourceReleaseDate: string | null;
  sourceDataPeriodStart: string | null;
  sourceDataPeriodEnd: string | null;
  recordsRead: number;
  recordsAccepted: number;
  recordsRejected: number;
  observationsPublished: number;
  cacheDisposition: "miss" | "hit" | "revalidated" | "stale_fallback" | null;
};

export const PLANNING_SOURCE_FAMILIES = [
  "state_clearinghouse",
  "county_local_health_department",
  "regional_planning_collaborative",
  "hospital_chna_csp_page",
] as const;

export type PlanningSourceFamily = (typeof PLANNING_SOURCE_FAMILIES)[number];

export const PLANNING_DOCUMENT_SCOPES = [
  "county_specific",
  "regional",
  "hospital_specific",
  "state_level",
] as const;

export type PlanningDocumentScope = (typeof PLANNING_DOCUMENT_SCOPES)[number];

export const CURRENT_PLAN_STATUSES = [
  "verified_current",
  "not_yet_verified",
  "superseded",
  "not_applicable",
] as const;

export type CurrentPlanStatus = (typeof CURRENT_PLAN_STATUSES)[number];

export type PlanningDocumentCandidate = {
  id: string;
  sourceFamily: PlanningSourceFamily;
  publisher: string;
  approvedHosts: string[];
  sourcePageUrl: string;
  artifactUrl: string;
  documentType: PlanningDocument["documentType"];
  title: string;
  coveredGeographyIds: string[];
  coverageScope: PlanningDocumentScope;
  publicationDate: string | null;
  publicationDatePrecision: "day" | "month" | "year" | "unknown";
  planCycleStart: string | null;
  planCycleEnd: string | null;
  retrievedAt: string;
  candidateConfidence: "high" | "moderate" | "low";
  candidateConfidenceScore: number;
  confidenceReasons: string[];
  reviewStatus: ReviewStatus;
};

export type PlanningDocument = {
  id: string;
  sourceVersionId: string;
  documentType: "cha" | "chip" | "chna" | "csp" | "implementation_strategy" | "supporting_report";
  title: string;
  publisher: string;
  officialUrl: string;
  publishedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  geographyIds: string[];
  contentHash: string;
  pageCount: number | null;
  coverageScope: PlanningDocumentScope;
  currentPlanStatus: CurrentPlanStatus;
  reviewStatus: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export type EvidenceClaim = {
  id: string;
  documentId: string;
  geographyIds: string[];
  claimType:
    | "priority"
    | "finding"
    | "disparity"
    | "barrier"
    | "objective"
    | "intervention"
    | "responsible_partner"
    | "target_population"
    | "evaluation_measure"
    | "asset"
    | "action"
    | "data_gap";
  statement: string;
  exactExcerpt: string;
  extractionMethod: "human" | "ocr" | "structured_parser" | "model_assisted";
  confidence: "high" | "moderate" | "low";
  reviewStatus: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export type PlanningReviewReason =
  | "candidate_source_not_approved"
  | "candidate_confidence_below_threshold"
  | "document_scope_ambiguous"
  | "covered_geography_ambiguous"
  | "publication_date_missing"
  | "plan_cycle_missing"
  | "current_plan_not_verified"
  | "citation_locator_missing"
  | "citation_text_mismatch"
  | "claim_not_explicit"
  | "extraction_confidence_low"
  | "formal_verification_required";

export type PlanningReviewTask = {
  id: string;
  candidateId: string;
  documentId: string | null;
  claimId: string | null;
  reason: PlanningReviewReason;
  status: "open" | "in_review" | "approved" | "rejected";
  severity: "blocking" | "review_required";
  summary: string;
  createdAt: string;
  assignedTo: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type EvidenceCitation = {
  id: string;
  claimId: string;
  documentId: string;
  sourceVersionId: string;
  pageNumber: number | null;
  artifactPageIndex?: number | null;
  section: string | null;
  paragraph: string | null;
  sourceField: string | null;
  quotedText: string;
  quotedTextHash: string;
  locatorBoundingBox: Record<string, number> | null;
  reviewStatus: ReviewStatus;
};

export type IngestionRun = {
  id: string;
  adapterId: string;
  sourceId: string;
  startedAt: string;
  completedAt: string | null;
  status: "started" | "validated" | "published" | "failed" | "quarantined";
  inputHash: string | null;
  outputHash: string | null;
  recordsRead: number;
  recordsAccepted: number;
  recordsRejected: number;
  errorSummary: string | null;
};

export type AuditEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: "created" | "updated" | "reviewed" | "published" | "staled" | "rejected";
  actorType: "system" | "human";
  actorId: string;
  occurredAt: string;
  reason: string;
  beforeHash: string | null;
  afterHash: string | null;
};
