import { createHash } from "node:crypto";

/**
 * Contracts for the Fall 2026 Place Intelligence release.  These helpers are
 * intentionally side-effect free: persistence and authorization live in the
 * application/runtime layer, while the Evidence Core owns the rules that
 * make collaboration, onboarding and measurement safe to persist.
 */

export const ADVANCED_COLLABORATION_CONTRACT_VERSION =
  "explore.agentic-collaboration.v1" as const;

export type WorkspaceShareScope = "read_only" | "contributor";
export type WorkspaceHandoffStatus = "pending" | "accepted" | "revoked" | "expired";
export type WorkspaceSessionStatus = "active" | "transferred" | "expired";

export type WorkspaceShareLink = {
  id: string;
  workspaceId: string;
  tenantId: string;
  scope: WorkspaceShareScope;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  createdBy: string;
  createdAt: string;
};

export type WorkspaceHandoff = {
  id: string;
  workspaceId: string;
  tenantId: string;
  sourcePrincipalId: string;
  targetRole: "county_planner" | "community_partner" | "research_funder_viewer" | "foundation_reviewer";
  tokenHash: string;
  status: WorkspaceHandoffStatus;
  expiresAt: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  createdAt: string;
};

export type WorkspaceFork = {
  sourceWorkspaceId: string;
  sourceVersion: number;
  targetWorkspaceId: string;
  forkedBy: string;
  forkedAt: string;
  copiedSectionKeys: string[];
  evidenceSnapshotId: string;
};

export type PilotOnboardingInput = {
  countyGeoid: string;
  organization: string;
  contactName: string;
  email: string;
  role: "county" | "provider" | "library" | "community_host" | "education_workforce" | "funder" | "research";
  intendedUse: string;
  consent: boolean;
  source: "explore" | "funder_snapshot" | "partner_referral" | "direct";
  environment: "staging" | "production" | "test";
};

export type PilotOnboardingDecision = {
  accepted: boolean;
  status: "ready_for_review" | "rejected";
  reasons: string[];
  retentionDays: number;
  prohibitedDataNotice: string;
};

export type EvidenceUsageEnvironment = "test" | "staging" | "production";

export type EvidenceUsageEvent = {
  eventName:
    | "place_resolved"
    | "brief_viewed"
    | "map_viewed"
    | "action_question_asked"
    | "visuals_viewed"
    | "workspace_created"
    | "workspace_shared"
    | "workspace_forked"
    | "workspace_handoff_created"
    | "funder_snapshot_exported"
    | "pilot_onboarding_started"
    | "pilot_onboarding_submitted"
    | "source_correction_requested";
  geographyId: string | null;
  workspaceId: string | null;
  sessionIdHash: string | null;
  environment: EvidenceUsageEnvironment;
  occurredAt: string;
  metadata: Record<string, string | number | boolean | null>;
  retentionUntil: string;
  countsAsTraction: boolean;
};

export type PerformanceSample = {
  operation: "place_brief" | "agent_response" | "map_geometry" | "workspace_event" | "source_refresh";
  environment: EvidenceUsageEnvironment;
  latencyMs: number;
  success: boolean;
  errorClass: string | null;
  estimatedCostMicros: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  correctionRequired: boolean;
  occurredAt: string;
};

export type SourceChangeProposal = {
  sourceId: string;
  contractVersion: string;
  previousSnapshotId: string | null;
  candidateRelease: string | null;
  candidateChecksum: string | null;
  changeType: "new_release" | "schema_drift" | "coverage_regression" | "meaning_change" | "source_withdrawn";
  status: "review_required" | "blocked";
  publishable: false;
  pullRequestBody: string;
  findings: string[];
};

export type EntityIpReadinessCheck = {
  checkId: string;
  area: "entity" | "trademark" | "copyright" | "data_license" | "privacy" | "contract";
  status: "not_started" | "in_review" | "ready" | "blocked";
  owner: string;
  evidenceUrl: string | null;
  dueDate: string | null;
  notes: string;
};

const PROHIBITED_ONBOARDING_TERMS = [
  "medical record",
  "diagnose",
  "diagnosis",
  "treatment",
  "prescription",
  "patient name",
  "protected health information",
  "phi",
] as const;

function includesProhibitedOnboardingTerm(value: string) {
  let normalized = "";
  for (const character of value.toLowerCase()) {
    const code = character.charCodeAt(0);
    const isAsciiLetter = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    if (isAsciiLetter || isDigit) {
      normalized += character;
    } else if (normalized.length > 0 && !normalized.endsWith(" ")) {
      normalized += " ";
    }
  }
  normalized = normalized.trim();
  return PROHIBITED_ONBOARDING_TERMS.some((term) => normalized.includes(term));
}

function hasValidEmailShape(value: string) {
  if (value.length < 5 || value.length > 254) return false;
  for (const character of value) {
    if (character <= " " || "<>[](),\\;:".includes(character)) return false;
  }
  const at = value.indexOf("@");
  const lastAt = value.lastIndexOf("@");
  if (at <= 0 || at !== lastAt || at === value.length - 1) return false;
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  return dot > 0 && dot < domain.length - 1 && !domain.startsWith(".") && !domain.endsWith(".");
}

export function evaluatePilotOnboarding(input: PilotOnboardingInput): PilotOnboardingDecision {
  const reasons: string[] = [];
  if (!/^\d{5}$/.test(input.countyGeoid)) reasons.push("County GEOID must be a five-digit Census identifier.");
  if (input.organization.trim().length < 2 || input.organization.trim().length > 180) reasons.push("Organization is required and must be concise.");
  if (input.contactName.trim().length < 2 || input.contactName.trim().length > 120) reasons.push("A contact name is required.");
  if (!hasValidEmailShape(input.email)) reasons.push("A valid organizational email is required.");
  if (input.intendedUse.trim().length < 10 || input.intendedUse.trim().length > 1000) reasons.push("Describe the intended non-clinical use in plain language.");
  if (includesProhibitedOnboardingTerm(input.intendedUse)) reasons.push("Do not submit medical, patient or protected health information.");
  if (!input.consent) reasons.push("Consent is required to use the information for pilot follow-up.");
  if (input.environment === "test") reasons.push("Test activity cannot create a production pilot request.");
  return {
    accepted: reasons.length === 0,
    status: reasons.length === 0 ? "ready_for_review" : "rejected",
    reasons,
    retentionDays: 180,
    prohibitedDataNotice: "Do not submit medical information, patient records, diagnosis, treatment details or protected health information.",
  };
}

export function buildUsageEvent(input: Omit<EvidenceUsageEvent, "retentionUntil" | "countsAsTraction"> & { retentionDays?: number }): EvidenceUsageEvent {
  const retentionDays = Math.max(1, Math.min(730, input.retentionDays ?? (input.environment === "production" ? 180 : 30)));
  const retention = new Date(Date.parse(input.occurredAt) + retentionDays * 86_400_000).toISOString();
  return {
    ...input,
    retentionUntil: retention,
    // Test and staging activity is explicitly excluded from traction claims.
    countsAsTraction: input.environment === "production" && input.eventName === "pilot_onboarding_submitted",
  };
}

export function buildPerformanceSample(input: PerformanceSample): PerformanceSample {
  if (!Number.isFinite(input.latencyMs) || input.latencyMs < 0) throw new Error("Latency must be a non-negative finite number.");
  if (input.estimatedCostMicros !== null && (!Number.isFinite(input.estimatedCostMicros) || input.estimatedCostMicros < 0)) {
    throw new Error("Estimated cost must be null or a non-negative finite number.");
  }
  return {
    ...input,
    errorClass: input.success ? null : input.errorClass || "unknown",
    correctionRequired: Boolean(input.correctionRequired),
  };
}

export function buildSourceChangeProposal(input: {
  sourceId: string;
  contractVersion: string;
  previousSnapshotId: string | null;
  candidateRelease: string | null;
  candidateChecksum: string | null;
  changeType: SourceChangeProposal["changeType"];
  findings: string[];
}): SourceChangeProposal {
  const findings = input.findings.filter((item) => item.trim().length > 0);
  return {
    ...input,
    status: "review_required",
    publishable: false,
    findings,
    pullRequestBody: [
      `Source: ${input.sourceId}`,
      `Contract: ${input.contractVersion}`,
      `Change type: ${input.changeType}`,
      `Previous approved snapshot: ${input.previousSnapshotId ?? "none"}`,
      `Candidate release: ${input.candidateRelease ?? "not supplied"}`,
      `Candidate checksum: ${input.candidateChecksum ?? "not supplied"}`,
      "",
      ...findings.map((finding) => `- ${finding}`),
      "",
      "This proposal is guarded. It must not replace the approved snapshot until an authorized reviewer approves the mapping, geography, source meaning and validation results.",
    ].join("\n"),
  };
}

export function buildWorkspaceFork(input: {
  sourceWorkspaceId: string;
  sourceVersion: number;
  targetWorkspaceId: string;
  forkedBy: string;
  forkedAt: string;
  copiedSectionKeys: string[];
  evidenceSnapshotId: string;
}): WorkspaceFork {
  if (!Number.isSafeInteger(input.sourceVersion) || input.sourceVersion < 1) throw new Error("Workspace version is invalid.");
  return { ...input, copiedSectionKeys: [...new Set(input.copiedSectionKeys)].sort() };
}

export function hashOpaqueToken(token: string) {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}
