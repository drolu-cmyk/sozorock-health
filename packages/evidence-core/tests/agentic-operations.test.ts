import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPerformanceSample,
  buildSourceChangeProposal,
  buildUsageEvent,
  buildWorkspaceFork,
  evaluatePilotOnboarding,
  hashOpaqueToken,
} from "../src/index.ts";

const now = "2026-08-01T12:00:00.000Z";

test("pilot onboarding rejects medical or protected information and requires consent", () => {
  const rejected = evaluatePilotOnboarding({
    countyGeoid: "36001",
    organization: "Albany partner",
    contactName: "A reviewer",
    email: "reviewer@example.org",
    role: "county",
    intendedUse: "We want to submit a patient record and diagnosis for triage.",
    consent: false,
    source: "explore",
    environment: "production",
  });
  assert.equal(rejected.accepted, false);
  assert.ok(rejected.reasons.some((reason) => /medical|protected/i.test(reason)));
  assert.ok(rejected.reasons.some((reason) => /consent/i.test(reason)));
});

test("valid production onboarding is ready for review but never auto-activates a pilot", () => {
  const decision = evaluatePilotOnboarding({
    countyGeoid: "36001",
    organization: "Albany County planning team",
    contactName: "A reviewer",
    email: "reviewer@example.org",
    role: "county",
    intendedUse: "Review county evidence and discuss a non-clinical planning workspace.",
    consent: true,
    source: "explore",
    environment: "production",
  });
  assert.equal(decision.accepted, true);
  assert.equal(decision.status, "ready_for_review");
  assert.equal(decision.retentionDays, 180);
});

test("test and staging activity cannot be counted as traction", () => {
  const testEvent = buildUsageEvent({
    eventName: "pilot_onboarding_submitted",
    geographyId: "36001",
    workspaceId: null,
    sessionIdHash: null,
    environment: "test",
    occurredAt: now,
    metadata: { suite: "e2e" },
  });
  const productionEvent = buildUsageEvent({
    ...testEvent,
    environment: "production",
  });
  assert.equal(testEvent.countsAsTraction, false);
  assert.equal(productionEvent.countsAsTraction, true);
  assert.equal(testEvent.retentionUntil, "2026-08-31T12:00:00.000Z");
});

test("performance metrics preserve correction and failure signals", () => {
  const sample = buildPerformanceSample({
    operation: "agent_response",
    environment: "production",
    latencyMs: 820,
    success: false,
    errorClass: "citation_validation",
    estimatedCostMicros: 4200,
    inputTokens: 900,
    outputTokens: 250,
    correctionRequired: true,
    occurredAt: now,
  });
  assert.equal(sample.errorClass, "citation_validation");
  assert.equal(sample.correctionRequired, true);
});

test("source changes produce guarded pull-request proposals", () => {
  const proposal = buildSourceChangeProposal({
    sourceId: "cdc-places",
    contractVersion: "cdc-places.2025.v1",
    previousSnapshotId: "snapshot-1",
    candidateRelease: "2026-08",
    candidateChecksum: `sha256:${"a".repeat(64)}`,
    changeType: "schema_drift",
    findings: ["The candidate adds a measure field with changed semantics."],
  });
  assert.equal(proposal.publishable, false);
  assert.equal(proposal.status, "review_required");
  assert.match(proposal.pullRequestBody, /must not replace the approved snapshot/i);
});

test("workspace forks are versioned and deduplicate copied sections", () => {
  const fork = buildWorkspaceFork({
    sourceWorkspaceId: "workspace-1",
    sourceVersion: 4,
    targetWorkspaceId: "workspace-2",
    forkedBy: "planner-1",
    forkedAt: now,
    copiedSectionKeys: ["action", "brief", "action"],
    evidenceSnapshotId: "snapshot-1",
  });
  assert.deepEqual(fork.copiedSectionKeys, ["action", "brief"]);
});

test("opaque tokens are stored as one-way hashes", () => {
  const hash = hashOpaqueToken("handoff-token");
  assert.match(hash, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(hash, "handoff-token");
});
