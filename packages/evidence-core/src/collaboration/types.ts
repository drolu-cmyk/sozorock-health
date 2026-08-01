export const WORKSPACE_EVENT_TYPES = [
  "workspace_created",
  "workspace_shared",
  "workspace_forked",
  "workspace_handoff_created",
  "workspace_handoff_accepted",
  "participant_joined",
  "evidence_loaded",
  "question_asked",
  "agent_tool_called",
  "agent_claim_validated",
  "result_added_to_plan",
  "scenario_created",
  "scenario_modified",
  "source_updated",
  "human_review_requested",
  "human_review_completed",
  "snapshot_exported",
  "workspace_archived",
] as const;

export type WorkspaceEventType = (typeof WORKSPACE_EVENT_TYPES)[number];
export type WorkspaceActorType = "human" | "agent" | "system";
export type WorkspaceAccess = "owner" | "contributor" | "viewer";
export type WorkspaceRole =
  | "foundation_reviewer"
  | "county_planner"
  | "community_partner"
  | "research_funder_viewer"
  | "evidence_agent";

export type WorkspaceActor = {
  principalId: string;
  actorType: WorkspaceActorType;
  role: WorkspaceRole;
  access: WorkspaceAccess;
  displayName: string;
};

export type WorkspaceEvent = {
  id: string;
  workspaceId: string;
  tenantId: string;
  sequenceNumber: number;
  eventType: WorkspaceEventType;
  actorType: WorkspaceActorType;
  actorId: string;
  idempotencyKey: string;
  evidenceSnapshotId: string | null;
  policyVersion: string;
  modelVersion: string | null;
  promptVersion: string | null;
  toolName: string | null;
  requestHash: string | null;
  responseHash: string | null;
  outcome: "accepted" | "rejected" | "failed" | "recorded";
  payload: Record<string, unknown>;
  occurredAt: string;
};

export type CountyWorkspace = {
  id: string;
  tenantId: string;
  geographyId: string;
  geographyAuthorityId: string;
  evidenceSnapshotId: string;
  title: string;
  status: "active" | "archived";
  version: number;
  policyVersion: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type WorkspaceSection = {
  workspaceId: string;
  sectionKey: string;
  version: number;
  content: Record<string, unknown>;
  updatedBy: string;
  updatedAt: string;
};

export type WorkspaceInvitation = {
  id: string;
  workspaceId: string;
  tokenHash: string;
  role: WorkspaceRole;
  access: WorkspaceAccess;
  invitedBy: string;
  expiresAt: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type AgentSuggestion = {
  id: string;
  workspaceId: string;
  sectionKey: string;
  executionAuditId: string | null;
  content: Record<string, unknown>;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export type WorkspaceConflict = {
  code: "version_conflict";
  expectedVersion: number;
  currentVersion: number;
  message: string;
};

export type ScenarioReviewStatus = "not_reviewed" | "review_requested" | "verified" | "rejected";

export type ScenarioInputs = {
  hubLocations: Array<{ type: "library" | "community" | "home"; count: number }> | null;
  eventFrequencyPerYear: number | null;
  verifiedPartnerCapacity: number | null;
  geographicReach: number | null;
  publicTransportationContext: string | null;
  digitalReadinessSupport: string | null;
  workforceAvailability: number | null;
  confirmedLocalPriorityIds: string[];
  assumptions: Array<{ key: string; value: string | number; owner: string }>;
};

export type ScenarioOutput = {
  contractVersion: "explore.scenario.v1";
  modelVersion: string;
  createdAt: string;
  assumptionOwner: string;
  inputs: ScenarioInputs;
  formulas: Array<{ output: string; expression: string; unit: string }>;
  evidenceUsed: string[];
  evidenceMissing: string[];
  range: {
    participation: { low: number; high: number; unit: "people_per_year" } | null;
    staffHours: { low: number; high: number; unit: "hours_per_year" } | null;
  };
  hubMix: Array<{ type: "library" | "community" | "home"; count: number }> | null;
  measurementPlan: string[];
  humanReviewStatus: ScenarioReviewStatus;
  disclosure: string;
};

export type EvidenceClaimAudit = {
  claimText: string;
  evidenceType:
    | "source_published_observation"
    | "sozorock_calculation"
    | "verified_local_planning_priority"
    | "modeled_scenario"
    | "evidence_gap"
    | "proposed_action_for_local_review";
  publisher: string;
  sourceTitle: string;
  officialUrl: string;
  releaseDate: string;
  dataPeriod: { start: string | null; end: string | null };
  geography: { kind: "county"; authorityId: string; displayName: string };
  measureFieldOrPassage: string;
  confidence: "high" | "moderate" | "low";
  limitations: string[];
  validatorOutcome: "accepted" | "blocked";
};

export type SourceAdapterContract = {
  sourceId: string;
  contractVersion: string;
  officialHostAllowlist: string[];
  schemaFingerprint: string;
  releaseDiscovery: Record<string, unknown>;
  retrievalSchedule: string;
  freshnessPolicy: Record<string, unknown>;
  measureMappingVersion: string;
  status: "active" | "paused" | "withdrawn" | "review_required";
  lastApprovedSnapshotId: string | null;
  rollbackSnapshotId: string | null;
};

export type SourceCandidateAssessment = {
  sourceId: string;
  contractVersion: string;
  status:
    | "validated"
    | "schema_drift"
    | "coverage_regression"
    | "retrieval_failed"
    | "withdrawn"
    | "awaiting_review";
  publishable: false;
  requiresHumanApproval: true;
  findings: string[];
};
