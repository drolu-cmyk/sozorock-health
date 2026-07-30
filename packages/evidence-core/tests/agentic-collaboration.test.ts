import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  REACH_NOT_CALCULATED,
  WorkspaceAuthorizationError,
  WorkspaceVersionConflictError,
  assessSourceCandidate,
  buildStructuredVisualResult,
  buildFunderEvidenceSnapshot,
  buildAdapterReviewProposal,
  SOURCE_ADAPTER_CONTRACTS,
  buildPlanningScenario,
  reviewAgentSuggestion,
  updateWorkspaceSection,
  type AgentSuggestion,
  type CountyWorkspace,
  type SourceAdapterContract,
  type WorkspaceActor,
  type WorkspaceEvent,
  type WorkspaceRepository,
  type WorkspaceSection,
} from "../src/index.ts";
import {
  buildCountyPlaceBrief,
  type CountyEvidenceSnapshot,
} from "../src/national/county-brief.ts";

const now = "2026-07-29T15:00:00.000Z";
const workspace: CountyWorkspace = {
  id: "workspace-1",
  tenantId: "tenant-1",
  geographyId: "geo-36001",
  geographyAuthorityId: "36001",
  evidenceSnapshotId: "snapshot-1",
  title: "Albany County planning workspace",
  status: "active",
  version: 1,
  policyVersion: "place-intelligence.v2",
  createdAt: now,
  createdBy: "reviewer-1",
  updatedAt: now,
};
const owner: WorkspaceActor = {
  principalId: "reviewer-1",
  actorType: "human",
  role: "foundation_reviewer",
  access: "owner",
  displayName: "Foundation reviewer",
};
const viewer: WorkspaceActor = {
  principalId: "viewer-1",
  actorType: "human",
  role: "research_funder_viewer",
  access: "viewer",
  displayName: "Research viewer",
};
const agent: WorkspaceActor = {
  principalId: "agent-1",
  actorType: "agent",
  role: "evidence_agent",
  access: "contributor",
  displayName: "Place Agent",
};

class MemoryWorkspaceRepository implements WorkspaceRepository {
  section: WorkspaceSection | null = null;
  suggestion: AgentSuggestion | null = {
    id: "suggestion-1",
    workspaceId: workspace.id,
    sectionKey: "response-fit",
    executionAuditId: null,
    content: { text: "Potentially supported for local review." },
    status: "pending",
    createdAt: now,
    reviewedBy: null,
    reviewedAt: null,
  };
  events: WorkspaceEvent[] = [];
  participants = new Map([owner, viewer, agent].map((actor) => [actor.principalId, actor]));
  getWorkspace(id: string) { return id === workspace.id ? workspace : null; }
  getParticipant(id: string, principalId: string) {
    return id === workspace.id ? this.participants.get(principalId) ?? null : null;
  }
  listEvents(id: string, after: number) {
    return this.events.filter((event) => event.workspaceId === id && event.sequenceNumber > after);
  }
  appendEvent(input: Omit<WorkspaceEvent, "sequenceNumber">) {
    const duplicate = this.events.find((event) => (
      event.workspaceId === input.workspaceId && event.idempotencyKey === input.idempotencyKey
    ));
    if (duplicate) return duplicate;
    const event = { ...input, sequenceNumber: this.events.length + 1 };
    this.events.push(event);
    return event;
  }
  getSection(id: string, key: string) {
    return this.section?.workspaceId === id && this.section.sectionKey === key ? this.section : null;
  }
  saveSection(section: WorkspaceSection, expected: number) {
    assert.equal(this.section?.version ?? 0, expected);
    this.section = section;
    return section;
  }
  getSuggestion(id: string, suggestionId: string) {
    return this.suggestion?.workspaceId === id && this.suggestion.id === suggestionId
      ? this.suggestion
      : null;
  }
  saveSuggestion(suggestion: AgentSuggestion) {
    this.suggestion = suggestion;
    return suggestion;
  }
}

test("workspace edits enforce access and optimistic concurrency", () => {
  const repository = new MemoryWorkspaceRepository();
  const first = updateWorkspaceSection(repository, {
    workspaceId: workspace.id,
    sectionKey: "planning-questions",
    content: { questions: ["Which local partner can verify transportation constraints?"] },
    expectedVersion: 0,
    actor: owner,
    now,
  });
  assert.equal(first.version, 1);
  assert.throws(() => updateWorkspaceSection(repository, {
    workspaceId: workspace.id,
    sectionKey: "planning-questions",
    content: {},
    expectedVersion: 0,
    actor: owner,
    now,
  }), WorkspaceVersionConflictError);
  assert.throws(() => updateWorkspaceSection(repository, {
    workspaceId: workspace.id,
    sectionKey: "planning-questions",
    content: {},
    expectedVersion: 1,
    actor: viewer,
    now,
  }), WorkspaceAuthorizationError);
});

test("agent suggestions cannot accept themselves", () => {
  const repository = new MemoryWorkspaceRepository();
  assert.throws(() => reviewAgentSuggestion(repository, {
    workspaceId: workspace.id,
    suggestionId: "suggestion-1",
    decision: "accepted",
    actor: agent,
    now,
  }), WorkspaceAuthorizationError);
  const reviewed = reviewAgentSuggestion(repository, {
    workspaceId: workspace.id,
    suggestionId: "suggestion-1",
    decision: "accepted",
    actor: owner,
    now,
  });
  assert.equal(reviewed.status, "accepted");
  assert.equal(reviewed.reviewedBy, owner.principalId);
});

test("scenario refuses reach when defensible capacity inputs are missing", () => {
  const scenario = buildPlanningScenario({
    inputs: {
      hubLocations: [{ type: "library", count: 1 }],
      eventFrequencyPerYear: 4,
      verifiedPartnerCapacity: null,
      geographicReach: null,
      publicTransportationContext: null,
      digitalReadinessSupport: "Partner assumption awaiting local review.",
      workforceAvailability: null,
      confirmedLocalPriorityIds: [],
      assumptions: [{ key: "event_frequency", value: 4, owner: "county-planner-1" }],
    },
    evidenceUsed: [],
    evidenceMissing: [],
    assumptionOwner: "county-planner-1",
    createdAt: now,
  });
  assert.equal(scenario.range.participation, null);
  assert.equal(scenario.range.staffHours, null);
  assert.equal(scenario.disclosure, REACH_NOT_CALCULATED);
  assert.deepEqual(
    scenario.evidenceMissing.sort(),
    ["Verified partner capacity", "Workforce availability"].sort(),
  );
});

test("scenario exposes formula, range, assumptions and model version when inputs exist", () => {
  const scenario = buildPlanningScenario({
    inputs: {
      hubLocations: [{ type: "community", count: 2 }],
      eventFrequencyPerYear: 6,
      verifiedPartnerCapacity: 40,
      geographicReach: null,
      publicTransportationContext: "Local review confirms limited evening service.",
      digitalReadinessSupport: "Two partner staff are available.",
      workforceAvailability: 30,
      confirmedLocalPriorityIds: ["claim-1"],
      assumptions: [{ key: "capacity", value: 40, owner: "partner-1" }],
    },
    evidenceUsed: ["claim-1"],
    evidenceMissing: [],
    assumptionOwner: "partner-1",
    createdAt: now,
  });
  assert.deepEqual(scenario.range.participation, {
    low: 126,
    high: 180,
    unit: "people_per_year",
  });
  assert.ok(scenario.formulas[0]?.expression.includes("verified_partner_capacity"));
  assert.equal(scenario.humanReviewStatus, "not_reviewed");
  assert.match(scenario.disclosure, /not a prediction/i);
});

test("source control detects schema drift and never auto-publishes", () => {
  const contract: SourceAdapterContract = {
    sourceId: "cdc-places",
    contractVersion: "v1",
    officialHostAllowlist: ["data.cdc.gov"],
    schemaFingerprint: `sha256:${"a".repeat(64)}`,
    releaseDiscovery: {},
    retrievalSchedule: "0 4 * * 1",
    freshnessPolicy: {},
    measureMappingVersion: "v1",
    status: "active",
    lastApprovedSnapshotId: "snapshot-1",
    rollbackSnapshotId: "snapshot-0",
  };
  const result = assessSourceCandidate(contract, {
    officialUrl: "https://data.cdc.gov/resource/example.json",
    schemaFingerprint: `sha256:${"b".repeat(64)}`,
    priorRecordCount: 100,
    candidateRecordCount: 100,
    retrievalSucceeded: true,
    withdrawn: false,
  });
  assert.equal(result.status, "schema_drift");
  assert.equal(result.publishable, false);
  assert.equal(result.requiresHumanApproval, true);
});

test("migration creates append-only collaboration, scenario and source-control records", () => {
  const migration = readFileSync(
    join(process.cwd(), "migrations", "0008_explore_agentic_collaboration.sql"),
    "utf8",
  );
  for (const table of [
    "county_workspace",
    "workspace_event",
    "planning_scenario_version",
    "funder_snapshot",
    "source_adapter_contract",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS evidence\\.${table}`));
  }
  assert.match(migration, /workspace_event_append_only/);
  assert.match(migration, /source_adapter_execution_append_only/);
});

test("structured visual result preserves measure metadata and separates planning priorities", () => {
  const snapshot = JSON.parse(readFileSync(
    join(process.cwd(), "data", "national", "county-evidence-snapshot.v1.json"),
    "utf8",
  )) as CountyEvidenceSnapshot;
  const brief = buildCountyPlaceBrief(
    snapshot.counties.find((county) => county.fips === "36001")!,
    snapshot,
    "36001",
  );
  const result = buildStructuredVisualResult(brief);
  assert.equal(result.geography.kind, "county");
  assert.equal(result.geography.authorityId, "36001");
  assert.ok(result.measureExplorer.length > 0);
  for (const measure of result.measureExplorer) {
    assert.ok(measure.unit);
    assert.ok(measure.universe);
    assert.ok(measure.adjustment);
    assert.ok(measure.releaseDate);
    assert.ok(measure.source.officialUrl.startsWith("https://"));
    assert.ok(measure.citations.length > 0);
  }
  assert.match(result.planningSignalMatrix.disclosure, /separate evidence types/i);
  assert.ok(result.limitations.some((item) => /No overall county health ranking/i.test(item)));
});

test("funder snapshot never fabricates reach and remains review-only", () => {
  const snapshot = JSON.parse(readFileSync(
    join(process.cwd(), "data", "national", "county-evidence-snapshot.v1.json"),
    "utf8",
  )) as CountyEvidenceSnapshot;
  const brief = buildCountyPlaceBrief(
    snapshot.counties.find((county) => county.fips === "36001")!,
    snapshot,
    "36001",
  );
  const output = buildFunderEvidenceSnapshot({ brief, scenario: null, generatedAt: now });
  assert.equal(output.releaseStatus, "review_only");
  assert.equal(output.geographicReach.status, "not_calculated");
  assert.equal(output.geographicReach.statement, REACH_NOT_CALCULATED);
  assert.equal(output.proposedResponse.requiresHumanReview, true);
  assert.ok(output.citations.length > 0);
});

test("every approved source adapter has a versioned control-plane contract", () => {
  assert.deepEqual(
    SOURCE_ADAPTER_CONTRACTS.map((contract) => contract.sourceId).sort(),
    [
      "ahrf-workforce",
      "ahrq-clh",
      "cdc-places",
      "census-acs5",
      "census-geography",
      "hrsa-workforce",
      "local-planning-documents",
    ],
  );
  for (const contract of SOURCE_ADAPTER_CONTRACTS) {
    assert.match(contract.schemaFingerprint, /^sha256:[0-9a-f]{64}$/);
    assert.ok(contract.officialHostAllowlist.length > 0);
    assert.ok(contract.retrievalSchedule);
    assert.match(contract.measureMappingVersion, /\.v\d+$/);
  }
});

test("adapter proposal cannot publish a changed source automatically", () => {
  const proposal = buildAdapterReviewProposal({
    sourceId: "cdc-places",
    contractVersion: "cdc-places.2025.v1",
    status: "schema_drift",
    publishable: false,
    requiresHumanApproval: true,
    findings: ["The candidate schema differs from the approved contract."],
  });
  assert.equal(proposal.publishable, false);
  assert.ok(proposal.labels.includes("human-review-required"));
  assert.match(proposal.body, /remain unchanged until an authorized reviewer approves/i);
});

test("local planning discovery accepts controlled government suffixes but rejects lookalikes", () => {
  const contract = SOURCE_ADAPTER_CONTRACTS.find(
    (candidate) => candidate.sourceId === "local-planning-documents",
  )!;
  const approved = assessSourceCandidate(contract, {
    officialUrl: "https://health.albanycounty.gov/community-plan",
    schemaFingerprint: contract.schemaFingerprint,
    priorRecordCount: 10,
    candidateRecordCount: 10,
    retrievalSucceeded: true,
    withdrawn: false,
  });
  const lookalike = assessSourceCandidate(contract, {
    officialUrl: "https://health.albanycounty.gov.example.com/community-plan",
    schemaFingerprint: contract.schemaFingerprint,
    priorRecordCount: 10,
    candidateRecordCount: 10,
    retrievalSucceeded: true,
    withdrawn: false,
  });
  assert.equal(approved.status, "awaiting_review");
  assert.equal(lookalike.status, "retrieval_failed");
});
