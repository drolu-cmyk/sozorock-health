import { randomBytes, randomUUID } from "node:crypto";
import type {
  EvidenceUsageEvent,
  PerformanceSample,
  ScenarioInputs,
  WorkspaceAccess,
  WorkspaceActor,
  WorkspaceEventType,
  WorkspaceRole,
} from "@sozorock/evidence-core";
import {
  buildPlanningScenario,
  buildUsageEvent,
  buildPerformanceSample,
  buildWorkspaceFork as buildWorkspaceForkContract,
  evaluatePilotOnboarding,
  hashOpaqueToken,
} from "@sozorock/evidence-core";
import {
  evidenceFieldValue,
  executeEvidenceSql,
  executeEvidenceTransaction,
  requireEvidenceCapability,
  assertSnapshotContentHash,
  sha256,
} from "./evidence-runtime-authority";
import { projectPublicWorkspacePlan, type PublicWorkspacePlan } from "./public-workspace-share";

const POLICY_VERSION = "place-intelligence.collaboration.v1";
const trustedMembershipAuthorization = Symbol("trusted-membership-authorization");
type WorkspaceEventInput = {
  workspaceId: string;
  tenantId: string;
  eventType: WorkspaceEventType;
  actor: WorkspaceActor;
  idempotencyKey: string;
  evidenceSnapshotId: string | null;
  payload: Record<string, unknown>;
  modelVersion?: string | null;
  promptVersion?: string | null;
  toolName?: string | null;
  requestHash?: string | null;
  responseHash?: string | null;
  outcome?: "accepted" | "rejected" | "failed" | "recorded";
  transactionId?: string;
  [trustedMembershipAuthorization]?: true;
};

export async function requireCollaborationCapability() {
  const result = await executeEvidenceSql(
    `SELECT enabled, reason
     FROM evidence.capability_switch
     WHERE capability_key='explore:collaboration'`,
  );
  const row = result.records?.[0];
  if (!row || evidenceFieldValue(row[0]) !== true) {
    throw new Error(String(evidenceFieldValue(row?.[1]) ?? "Explore collaboration is not enabled."));
  }
}

export async function requireWorkspaceMembership(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
  write?: boolean;
  allowedAccess?: WorkspaceAccess[];
  allowedRoles?: WorkspaceRole[];
  transactionId?: string;
}) {
  const result = await executeEvidenceSql(
    `SELECT p.access::text, p.role::text
     FROM evidence.county_workspace w
     JOIN evidence.workspace_participant p ON p.workspace_id=w.id
     WHERE w.id=CAST(:workspace_id AS uuid)
       AND w.tenant_id=CAST(:tenant_id AS uuid)
       AND p.principal_id=:principal_id
       AND p.revoked_at IS NULL
       AND w.status='active'
     LIMIT 1`,
    [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
      { name: "tenant_id", value: { stringValue: input.tenantId } },
      { name: "principal_id", value: { stringValue: input.actor.principalId } },
    ],
    input.transactionId,
  );
  const access = String(evidenceFieldValue(result.records?.[0]?.[0]) ?? "");
  const role = String(evidenceFieldValue(result.records?.[0]?.[1]) ?? "");
  const scopeRestricted = Boolean(input.allowedAccess?.length || input.allowedRoles?.length);
  const inAllowedScope = !scopeRestricted
    || input.allowedAccess?.includes(access as WorkspaceAccess) === true
    || input.allowedRoles?.includes(role as WorkspaceRole) === true;
  if (!access || (input.write && access === "viewer") || !inAllowedScope) {
    throw new Error("The participant is not authorized for this county workspace.");
  }
  return access;
}

export async function createCountyWorkspace(input: {
  tenantId: string;
  geoid: string;
  title: string;
  actor: WorkspaceActor;
  snapshotContentHash: string;
  idempotencyKey: string;
}) {
  if (input.actor.access !== "owner") throw new Error("Only an authorized owner may create a county workspace.");
  const snapshotContentHash = assertSnapshotContentHash(input.snapshotContentHash);
  return executeEvidenceTransaction(async (transactionId) => {
    const geography = await executeEvidenceSql(
      `SELECT id::text
       FROM evidence.geography
       WHERE kind='county' AND authority='census' AND authority_id=:geoid
         AND release_scope='primary_50_states_dc' AND review_status='verified'
       LIMIT 1`,
      [{ name: "geoid", value: { stringValue: input.geoid } }],
      transactionId,
    );
    const geographyId = String(evidenceFieldValue(geography.records?.[0]?.[0]) ?? "");
    if (!geographyId) throw new Error("The selected county is not in the approved geography snapshot.");
    const snapshot = await executeEvidenceSql(
      `SELECT id::text
       FROM evidence.evidence_snapshot
       WHERE content_hash=:hash AND review_status='verified' AND published_at IS NOT NULL`,
      [{ name: "hash", value: { stringValue: snapshotContentHash } }],
      transactionId,
    );
    const snapshotId = String(evidenceFieldValue(snapshot.records?.[0]?.[0]) ?? "");
    if (!snapshotId) throw new Error("No approved evidence snapshot is available for this workspace.");

    const tenant = await executeEvidenceSql(
      `SELECT id::text FROM evidence.workspace_tenant WHERE id=CAST(:tenant_id AS uuid) AND status='active'`,
      [{ name: "tenant_id", value: { stringValue: input.tenantId } }],
      transactionId,
    );
    if (!tenant.records?.[0]) throw new Error("The workspace tenant is not active.");

    const workspaceId = randomUUID();
    const created = await executeEvidenceSql(
      `INSERT INTO evidence.county_workspace (
         id, tenant_id, geography_id, evidence_snapshot_id, title, status,
         version, policy_version, created_at, created_by, updated_at
       ) VALUES (
         CAST(:id AS uuid), CAST(:tenant_id AS uuid), CAST(:geography_id AS uuid),
         CAST(:snapshot_id AS uuid), :title, 'active', 1, :policy_version,
         now(), :created_by, now()
       )
       ON CONFLICT (tenant_id, geography_id) WHERE status = 'active' AND parent_workspace_id IS NULL
       DO UPDATE SET updated_at=evidence.county_workspace.updated_at
       RETURNING id::text, title, version`,
      [
        { name: "id", value: { stringValue: workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
        { name: "geography_id", value: { stringValue: geographyId } },
        { name: "snapshot_id", value: { stringValue: snapshotId } },
        { name: "title", value: { stringValue: input.title.slice(0, 240) } },
        { name: "policy_version", value: { stringValue: POLICY_VERSION } },
        { name: "created_by", value: { stringValue: input.actor.principalId } },
      ],
      transactionId,
    );
    const id = String(evidenceFieldValue(created.records?.[0]?.[0]) ?? "");
    await executeEvidenceSql(
      `INSERT INTO evidence.workspace_participant (
         workspace_id, principal_id, role, access, display_name, joined_at
       ) VALUES (
         CAST(:workspace_id AS uuid), :principal_id, CAST(:role AS evidence.workspace_role),
         CAST(:access AS evidence.workspace_access), :display_name, now()
       ) ON CONFLICT (workspace_id, principal_id) DO NOTHING`,
      [
        { name: "workspace_id", value: { stringValue: id } },
        { name: "principal_id", value: { stringValue: input.actor.principalId } },
        { name: "role", value: { stringValue: input.actor.role } },
        { name: "access", value: { stringValue: input.actor.access } },
        { name: "display_name", value: { stringValue: input.actor.displayName } },
      ],
      transactionId,
    );
    await executeEvidenceSql(
      `INSERT INTO evidence.workspace_participant (
         workspace_id, principal_id, role, access, display_name, joined_at
       ) VALUES (
         CAST(:workspace_id AS uuid), 'sozorock-place-agent', 'evidence_agent',
         'contributor', 'SozoRock Place Intelligence', now()
       ) ON CONFLICT (workspace_id, principal_id) DO NOTHING`,
      [{ name: "workspace_id", value: { stringValue: id } }],
      transactionId,
    );
    await appendWorkspaceEvent({
      workspaceId: id,
      tenantId: input.tenantId,
      eventType: "workspace_created",
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      evidenceSnapshotId: snapshotId,
      payload: { geoid: input.geoid, title: input.title.slice(0, 240) },
      transactionId,
    });
    return {
      id,
      title: String(evidenceFieldValue(created.records?.[0]?.[1]) ?? input.title),
      version: Number(evidenceFieldValue(created.records?.[0]?.[2]) ?? 1),
      geoid: input.geoid,
      evidenceSnapshotId: snapshotId,
    };
  });
}

export async function appendWorkspaceEvent(input: WorkspaceEventInput) {
  const run = async (transactionId: string) => {
    await executeEvidenceSql(
      `SELECT pg_advisory_xact_lock(hashtext(:workspace_id))`,
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
      transactionId,
    );
    const authorization = await executeEvidenceSql(
      `SELECT p.access::text
       FROM evidence.county_workspace w
       JOIN evidence.workspace_participant p ON p.workspace_id=w.id
       WHERE w.id=CAST(:workspace_id AS uuid)
         AND w.tenant_id=CAST(:tenant_id AS uuid)
         AND p.principal_id=:principal_id
         AND p.revoked_at IS NULL
         AND w.status='active'`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
        { name: "principal_id", value: { stringValue: input.actor.principalId } },
      ],
      transactionId,
    );
    const access = String(evidenceFieldValue(authorization.records?.[0]?.[0]) ?? "");
    const trustedMembership = input[trustedMembershipAuthorization] === true;
    // Read-only participants may observe the event stream, but they may never
    // append an event. The only exception is the private server-side,
    // transaction-bound membership path below.
    if (trustedMembership && !["participant_joined", "workspace_handoff_accepted"].includes(input.eventType)) {
      throw new Error("The trusted membership path only records membership events.");
    }
    if (!trustedMembership && (!access || access === "viewer")) {
      throw new Error("The participant is not authorized to write this workspace event.");
    }
    const inserted = await executeEvidenceSql(
      `INSERT INTO evidence.workspace_event (
         id, workspace_id, tenant_id, sequence_number, event_type, actor_type,
         actor_id, idempotency_key, evidence_snapshot_id, policy_version,
         model_version, prompt_version, tool_name, request_hash, response_hash,
         outcome, payload, occurred_at
       ) SELECT
         CAST(:id AS uuid), CAST(:workspace_id AS uuid), CAST(:tenant_id AS uuid),
         COALESCE(MAX(sequence_number), 0) + 1, CAST(:event_type AS evidence.workspace_event_type),
         CAST(:actor_type AS evidence.workspace_actor_type), :actor_id, :idempotency_key,
         CAST(:snapshot_id AS uuid), :policy_version, :model_version, :prompt_version,
         :tool_name, :request_hash, :response_hash, :outcome, CAST(:payload AS jsonb), now()
       FROM evidence.workspace_event WHERE workspace_id=CAST(:workspace_id AS uuid)
       ON CONFLICT (workspace_id, idempotency_key)
       DO NOTHING
       RETURNING id::text, sequence_number, event_type::text, occurred_at::text`,
      [
        { name: "id", value: { stringValue: randomUUID() } },
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
        { name: "event_type", value: { stringValue: input.eventType } },
        { name: "actor_type", value: { stringValue: input.actor.actorType } },
        { name: "actor_id", value: { stringValue: input.actor.principalId } },
        { name: "idempotency_key", value: { stringValue: input.idempotencyKey.slice(0, 200) } },
        input.evidenceSnapshotId
          ? { name: "snapshot_id", value: { stringValue: input.evidenceSnapshotId } }
          : { name: "snapshot_id", value: { isNull: true } },
        { name: "policy_version", value: { stringValue: POLICY_VERSION } },
        input.modelVersion
          ? { name: "model_version", value: { stringValue: input.modelVersion } }
          : { name: "model_version", value: { isNull: true } },
        input.promptVersion
          ? { name: "prompt_version", value: { stringValue: input.promptVersion } }
          : { name: "prompt_version", value: { isNull: true } },
        input.toolName
          ? { name: "tool_name", value: { stringValue: input.toolName } }
          : { name: "tool_name", value: { isNull: true } },
        input.requestHash
          ? { name: "request_hash", value: { stringValue: input.requestHash } }
          : { name: "request_hash", value: { isNull: true } },
        input.responseHash
          ? { name: "response_hash", value: { stringValue: input.responseHash } }
          : { name: "response_hash", value: { isNull: true } },
        { name: "outcome", value: { stringValue: input.outcome ?? "recorded" } },
        { name: "payload", value: { stringValue: JSON.stringify(input.payload) } },
      ],
      transactionId,
    );
    const insertedRecord = inserted.records?.[0];
    if (insertedRecord) {
      return {
        id: String(evidenceFieldValue(insertedRecord[0]) ?? ""),
        sequenceNumber: Number(evidenceFieldValue(insertedRecord[1]) ?? 0),
        eventType: String(evidenceFieldValue(insertedRecord[2]) ?? input.eventType),
        occurredAt: String(evidenceFieldValue(insertedRecord[3]) ?? ""),
        inserted: true,
      };
    }
    const existing = await executeEvidenceSql(
      `SELECT id::text, sequence_number, event_type::text, occurred_at::text
       FROM evidence.workspace_event
       WHERE workspace_id=CAST(:workspace_id AS uuid)
         AND tenant_id=CAST(:tenant_id AS uuid)
         AND idempotency_key=:idempotency_key`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
        { name: "idempotency_key", value: { stringValue: input.idempotencyKey.slice(0, 200) } },
      ],
      transactionId,
    );
    const existingRecord = existing.records?.[0];
    if (!existingRecord) {
      throw new Error("The idempotent workspace event could not be recovered.");
    }
    return {
      id: String(evidenceFieldValue(existingRecord[0]) ?? ""),
      sequenceNumber: Number(evidenceFieldValue(existingRecord[1]) ?? 0),
      eventType: String(evidenceFieldValue(existingRecord[2]) ?? input.eventType),
      occurredAt: String(evidenceFieldValue(existingRecord[3]) ?? ""),
      inserted: false,
    };
  };
  return input.transactionId ? run(input.transactionId) : executeEvidenceTransaction(run);
}

async function findWorkspaceMutationEvent(input: {
  workspaceId: string;
  tenantId: string;
  idempotencyKey: string;
  transactionId: string;
}) {
  const result = await executeEvidenceSql(
    `SELECT id::text, sequence_number, event_type::text, occurred_at::text, payload::text
     FROM evidence.workspace_event
     WHERE workspace_id=CAST(:workspace_id AS uuid)
       AND tenant_id=CAST(:tenant_id AS uuid)
       AND idempotency_key=:idempotency_key`,
    [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
      { name: "tenant_id", value: { stringValue: input.tenantId } },
      { name: "idempotency_key", value: { stringValue: input.idempotencyKey.slice(0, 200) } },
    ],
    input.transactionId,
  );
  const row = result.records?.[0];
  if (!row) return null;
  return {
    id: String(evidenceFieldValue(row[0]) ?? ""),
    sequenceNumber: Number(evidenceFieldValue(row[1]) ?? 0),
    eventType: String(evidenceFieldValue(row[2]) ?? ""),
    occurredAt: String(evidenceFieldValue(row[3]) ?? ""),
    payload: JSON.parse(String(evidenceFieldValue(row[4]) ?? "{}")) as Record<string, unknown>,
    inserted: false as const,
  };
}

async function findLegacyWorkspaceFork(input: {
  workspaceId: string;
  tenantId: string;
  idempotencyKey: string;
  transactionId: string;
}) {
  const result = await executeEvidenceSql(
    `SELECT source_event.id::text, source_event.sequence_number,
        source_event.event_type::text, source_event.occurred_at::text,
        source_event.payload::text, target.id::text, target.title,
        target.forked_from_version, target.evidence_snapshot_id::text,
        target_event.payload::text, source.title
     FROM evidence.workspace_event target_event
     JOIN evidence.county_workspace target ON target.id=target_event.workspace_id
     JOIN evidence.county_workspace source ON source.id=target.parent_workspace_id
     JOIN evidence.workspace_event source_event
       ON source_event.workspace_id=source.id
      AND source_event.tenant_id=target_event.tenant_id
      AND source_event.event_type='workspace_forked'
      AND source_event.idempotency_key=('workspace-forked:' || target.id::text)
     WHERE source.id=CAST(:workspace_id AS uuid)
       AND source.tenant_id=CAST(:tenant_id AS uuid)
       AND target.tenant_id=source.tenant_id
       AND target.status='active'
       AND target_event.event_type='workspace_created'
       AND target_event.idempotency_key=:idempotency_key
       AND target_event.payload->>'forkedFrom'=:workspace_id
     LIMIT 1`,
    [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
      { name: "tenant_id", value: { stringValue: input.tenantId } },
      { name: "idempotency_key", value: { stringValue: input.idempotencyKey.slice(0, 200) } },
    ],
    input.transactionId,
  );
  const row = result.records?.[0];
  if (!row) return null;
  return {
    event: {
      id: String(evidenceFieldValue(row[0]) ?? ""),
      sequenceNumber: Number(evidenceFieldValue(row[1]) ?? 0),
      eventType: String(evidenceFieldValue(row[2]) ?? "workspace_forked"),
      occurredAt: String(evidenceFieldValue(row[3]) ?? ""),
      payload: JSON.parse(String(evidenceFieldValue(row[4]) ?? "{}")) as Record<string, unknown>,
      inserted: false as const,
    },
    targetWorkspaceId: String(evidenceFieldValue(row[5]) ?? ""),
    targetTitle: String(evidenceFieldValue(row[6]) ?? ""),
    sourceVersion: Number(evidenceFieldValue(row[7]) ?? 0),
    evidenceSnapshotId: String(evidenceFieldValue(row[8]) ?? ""),
    targetPayload: JSON.parse(String(evidenceFieldValue(row[9]) ?? "{}")) as Record<string, unknown>,
    sourceTitle: String(evidenceFieldValue(row[10]) ?? "workspace"),
  };
}

/**
 * Internal-only event writer used after the invitation/handoff transaction has
 * validated token, tenant, workspace, role, expiry and recipient. The symbol
 * authorization cannot be supplied by a client route.
 */
async function appendTrustedMembershipEvent(input: Omit<WorkspaceEventInput, typeof trustedMembershipAuthorization>) {
  return appendWorkspaceEvent({ ...input, [trustedMembershipAuthorization]: true });
}

export async function listWorkspaceEvents(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
  afterSequence: number;
}) {
  const result = await executeEvidenceSql(
    `SELECT e.id::text, e.sequence_number, e.event_type::text, e.actor_type::text,
       e.actor_id, e.outcome, e.payload::text, e.occurred_at::text
     FROM evidence.workspace_event e
     JOIN evidence.workspace_participant p ON p.workspace_id=e.workspace_id
     WHERE e.workspace_id=CAST(:workspace_id AS uuid)
       AND e.tenant_id=CAST(:tenant_id AS uuid)
       AND p.principal_id=:principal_id AND p.revoked_at IS NULL
       AND e.sequence_number > :after_sequence
     ORDER BY e.sequence_number ASC LIMIT 500`,
    [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
      { name: "tenant_id", value: { stringValue: input.tenantId } },
      { name: "principal_id", value: { stringValue: input.actor.principalId } },
      { name: "after_sequence", value: { longValue: input.afterSequence } },
    ],
  );
  return (result.records ?? []).map((row) => ({
    id: String(evidenceFieldValue(row[0]) ?? ""),
    sequenceNumber: Number(evidenceFieldValue(row[1]) ?? 0),
    eventType: String(evidenceFieldValue(row[2]) ?? ""),
    actorType: String(evidenceFieldValue(row[3]) ?? ""),
    actorId: String(evidenceFieldValue(row[4]) ?? ""),
    outcome: String(evidenceFieldValue(row[5]) ?? ""),
    payload: JSON.parse(String(evidenceFieldValue(row[6]) ?? "{}")) as Record<string, unknown>,
    occurredAt: String(evidenceFieldValue(row[7]) ?? ""),
  }));
}

export async function createPlanningScenario(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
  name: string;
  scenarioInputs: ScenarioInputs;
  evidenceUsed: string[];
  evidenceMissing: string[];
  idempotencyKey: string;
}) {
  await requireEvidenceCapability("explore:scenarios");
  if (input.actor.actorType !== "human") {
    throw new Error("A human participant must own planning assumptions.");
  }
  const output = buildPlanningScenario({
    inputs: input.scenarioInputs,
    evidenceUsed: input.evidenceUsed,
    evidenceMissing: input.evidenceMissing,
    assumptionOwner: input.actor.principalId,
    createdAt: new Date().toISOString(),
    humanReviewStatus: "not_reviewed",
  });
  const scenarioRequestHash = sha256({
    name: input.name.slice(0, 160),
    scenarioInputs: output.inputs,
    evidenceUsed: output.evidenceUsed,
    evidenceMissing: output.evidenceMissing,
  });
  return executeEvidenceTransaction(async (transactionId) => {
    await requireWorkspaceMembership({
      workspaceId: input.workspaceId,
      tenantId: input.tenantId,
      actor: input.actor,
      write: true,
      transactionId,
    });
    await executeEvidenceSql(
      "SELECT pg_advisory_xact_lock(hashtext(:workspace_id))",
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
      transactionId,
    );
    const priorCreation = await executeEvidenceSql(
      `SELECT id::text, sequence_number, event_type::text, occurred_at::text, payload::text
       FROM evidence.workspace_event
       WHERE workspace_id=CAST(:workspace_id AS uuid)
         AND tenant_id=CAST(:tenant_id AS uuid)
         AND idempotency_key=:idempotency_key
       FOR UPDATE`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
        { name: "idempotency_key", value: { stringValue: input.idempotencyKey.slice(0, 200) } },
      ],
      transactionId,
    );
    const priorCreationRecord = priorCreation.records?.[0];
    if (priorCreationRecord) {
      const eventType = String(evidenceFieldValue(priorCreationRecord[2]) ?? "");
      const payload = JSON.parse(String(evidenceFieldValue(priorCreationRecord[4]) ?? "{}")) as Record<string, unknown>;
      if (eventType !== "scenario_created") {
        throw new Error("The idempotency key is already bound to a different workspace mutation.");
      }
      const scenarioId = String(payload.scenarioId ?? "");
      const versionId = String(payload.scenarioVersionId ?? "");
      const priorVersion = await executeEvidenceSql(
        `SELECT v.outputs::text, s.name
         FROM evidence.planning_scenario_version v
         JOIN evidence.planning_scenario s ON s.id=v.scenario_id
         WHERE v.id=CAST(:version_id AS uuid) AND v.scenario_id=CAST(:scenario_id AS uuid)`,
        [
          { name: "version_id", value: { stringValue: versionId } },
          { name: "scenario_id", value: { stringValue: scenarioId } },
        ],
        transactionId,
      );
      if (!priorVersion.records?.[0]?.[0]) throw new Error("The idempotent scenario version could not be recovered.");
      const priorOutput = JSON.parse(String(evidenceFieldValue(priorVersion.records[0][0]) ?? "{}")) as typeof output;
      // Reconstruct the canonical request from immutable persisted state. This
      // accepts hashes written before canonical JSON serialization without
      // trusting their key order, while still rejecting reuse for a different
      // mutation.
      const persistedRequestHash = sha256({
        name: String(evidenceFieldValue(priorVersion.records[0][1]) ?? payload.name ?? ""),
        scenarioInputs: priorOutput.inputs,
        evidenceUsed: priorOutput.evidenceUsed,
        evidenceMissing: priorOutput.evidenceMissing,
      });
      if (persistedRequestHash !== scenarioRequestHash) {
        throw new Error("The idempotency key is already bound to a different workspace mutation.");
      }
      return {
        id: scenarioId,
        versionId,
        output: priorOutput,
        event: {
          id: String(evidenceFieldValue(priorCreationRecord[0]) ?? ""),
          sequenceNumber: Number(evidenceFieldValue(priorCreationRecord[1]) ?? 0),
          eventType,
          occurredAt: String(evidenceFieldValue(priorCreationRecord[3]) ?? ""),
          inserted: false,
        },
      };
    }
    const scenarioId = randomUUID();
    const versionId = randomUUID();
    await executeEvidenceSql(
      `INSERT INTO evidence.planning_scenario (
         id, workspace_id, name, status, current_version, created_by, created_at
       ) VALUES (
         CAST(:id AS uuid), CAST(:workspace_id AS uuid), :name, 'draft', 1, :created_by, now()
       )`,
      [
        { name: "id", value: { stringValue: scenarioId } },
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "name", value: { stringValue: input.name.slice(0, 160) } },
        { name: "created_by", value: { stringValue: input.actor.principalId } },
      ],
      transactionId,
    );
    await executeEvidenceSql(
      `INSERT INTO evidence.planning_scenario_version (
         id, scenario_id, version, model_version, inputs, formulae, evidence_used,
         evidence_missing, outputs, assumption_owner, human_review_status,
         created_by, created_at
       ) VALUES (
         CAST(:id AS uuid), CAST(:scenario_id AS uuid), 1, :model_version,
         CAST(:inputs AS jsonb), CAST(:formulae AS jsonb), CAST(:evidence_used AS jsonb),
         CAST(:evidence_missing AS jsonb), CAST(:outputs AS jsonb), :assumption_owner,
         'not_reviewed', :created_by, now()
       )`,
      [
        { name: "id", value: { stringValue: versionId } },
        { name: "scenario_id", value: { stringValue: scenarioId } },
        { name: "model_version", value: { stringValue: output.modelVersion } },
        { name: "inputs", value: { stringValue: JSON.stringify(output.inputs) } },
        { name: "formulae", value: { stringValue: JSON.stringify(output.formulas) } },
        { name: "evidence_used", value: { stringValue: JSON.stringify(output.evidenceUsed) } },
        { name: "evidence_missing", value: { stringValue: JSON.stringify(output.evidenceMissing) } },
        { name: "outputs", value: { stringValue: JSON.stringify(output) } },
        { name: "assumption_owner", value: { stringValue: input.actor.principalId } },
        { name: "created_by", value: { stringValue: input.actor.principalId } },
      ],
      transactionId,
    );
    const event = await appendWorkspaceEvent({
      workspaceId: input.workspaceId,
      tenantId: input.tenantId,
      eventType: "scenario_created",
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      evidenceSnapshotId: null,
      payload: {
        scenarioId,
        scenarioVersionId: versionId,
        name: input.name.slice(0, 160),
        humanReviewStatus: output.humanReviewStatus,
        requestHash: scenarioRequestHash,
      },
      transactionId,
    });
    return { id: scenarioId, versionId, output, event };
  });
}

export async function reviewPlanningScenario(input: {
  workspaceId: string; tenantId: string; actor: WorkspaceActor; scenarioId: string;
  decision: "verified" | "rejected"; idempotencyKey: string;
}) {
  if (input.actor.actorType !== "human") throw new Error("An authorized human reviewer is required.");
  return executeEvidenceTransaction(async (transactionId) => {
    await requireWorkspaceMembership({ ...input, write: true, transactionId });
    await executeEvidenceSql(
      "SELECT pg_advisory_xact_lock(hashtext(:workspace_id))",
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
      transactionId,
    );
    const priorReview = await executeEvidenceSql(
      `SELECT id::text, sequence_number, event_type::text, occurred_at::text, payload::text
       FROM evidence.workspace_event
       WHERE workspace_id=CAST(:workspace_id AS uuid)
         AND tenant_id=CAST(:tenant_id AS uuid)
         AND idempotency_key=:idempotency_key
       FOR UPDATE`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
        { name: "idempotency_key", value: { stringValue: input.idempotencyKey.slice(0, 200) } },
      ],
      transactionId,
    );
    const priorReviewRecord = priorReview.records?.[0];
    if (priorReviewRecord) {
      const eventType = String(evidenceFieldValue(priorReviewRecord[2]) ?? "");
      const payload = JSON.parse(String(evidenceFieldValue(priorReviewRecord[4]) ?? "{}")) as Record<string, unknown>;
      if (eventType !== "human_review_completed"
        || payload.scenarioId !== input.scenarioId
        || payload.decision !== input.decision) {
        throw new Error("The idempotency key is already bound to a different workspace mutation.");
      }
      return {
        scenarioId: input.scenarioId,
        version: Number(payload.version ?? 0),
        humanReviewStatus: input.decision,
        event: {
          id: String(evidenceFieldValue(priorReviewRecord[0]) ?? ""),
          sequenceNumber: Number(evidenceFieldValue(priorReviewRecord[1]) ?? 0),
          eventType,
          occurredAt: String(evidenceFieldValue(priorReviewRecord[3]) ?? ""),
          inserted: false,
        },
      };
    }
    const result = await executeEvidenceSql(`SELECT current_version FROM evidence.planning_scenario WHERE id=CAST(:scenario_id AS uuid) AND workspace_id=CAST(:workspace_id AS uuid) FOR UPDATE`, [
      { name: "scenario_id", value: { stringValue: input.scenarioId } }, { name: "workspace_id", value: { stringValue: input.workspaceId } },
    ], transactionId);
    const version = Number(evidenceFieldValue(result.records?.[0]?.[0]) ?? 0);
    if (!version) throw new Error("The scenario is unavailable.");
    const reviewedVersion = version + 1;
    const reviewedVersionId = randomUUID();
    const inserted = await executeEvidenceSql(
      `INSERT INTO evidence.planning_scenario_version (
         id, scenario_id, version, model_version, inputs, formulae, evidence_used,
         evidence_missing, outputs, assumption_owner, human_review_status,
         created_by, created_at
       )
       SELECT CAST(:version_id AS uuid), scenario_id, :reviewed_version, model_version,
         inputs, formulae, evidence_used, evidence_missing,
         jsonb_set(outputs, '{humanReviewStatus}', to_jsonb(CAST(:decision AS text)), true), assumption_owner,
         :decision, :reviewed_by, now()
       FROM evidence.planning_scenario_version
       WHERE scenario_id=CAST(:scenario_id AS uuid) AND version=:source_version
       RETURNING id::text`,
      [
        { name: "version_id", value: { stringValue: reviewedVersionId } },
        { name: "reviewed_version", value: { longValue: reviewedVersion } },
        { name: "decision", value: { stringValue: input.decision } },
        { name: "reviewed_by", value: { stringValue: input.actor.principalId } },
        { name: "scenario_id", value: { stringValue: input.scenarioId } },
        { name: "source_version", value: { longValue: version } },
      ],
      transactionId,
    );
    if (!inserted.records?.[0]) throw new Error("The scenario version is unavailable.");
    await executeEvidenceSql(`UPDATE evidence.planning_scenario SET status=:status, current_version=:reviewed_version WHERE id=CAST(:scenario_id AS uuid)`, [
      { name: "status", value: { stringValue: input.decision === "verified" ? "accepted" : "local_review" } },
      { name: "reviewed_version", value: { longValue: reviewedVersion } },
      { name: "scenario_id", value: { stringValue: input.scenarioId } },
    ], transactionId);
    const event = await appendWorkspaceEvent({ workspaceId: input.workspaceId, tenantId: input.tenantId, eventType: "human_review_completed", actor: input.actor, idempotencyKey: input.idempotencyKey, evidenceSnapshotId: null, payload: { scenarioId: input.scenarioId, reviewedFromVersion: version, version: reviewedVersion, scenarioVersionId: reviewedVersionId, decision: input.decision }, transactionId });
    return { scenarioId: input.scenarioId, version: reviewedVersion, humanReviewStatus: input.decision, event };
  });
}

async function loadWorkspacePlan(input: { workspaceId: string; tenantId: string }) {
  const [workspace, sections, comments, questions, suggestions, scenarios, participants] = await Promise.all([
    executeEvidenceSql(
      `SELECT w.id::text, w.title, w.version, w.status, w.updated_at::text,
         g.authority_id, g.name
       FROM evidence.county_workspace w
       JOIN evidence.geography g ON g.id=w.geography_id
       WHERE w.id=CAST(:workspace_id AS uuid) AND w.tenant_id=CAST(:tenant_id AS uuid)`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
      ],
    ),
    executeEvidenceSql(
      `SELECT section_key, version, content::text, updated_by, updated_at::text
       FROM evidence.workspace_section WHERE workspace_id=CAST(:workspace_id AS uuid)
       ORDER BY section_key`,
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
    ),
    executeEvidenceSql(
      `SELECT id::text, section_key, actor_id, body, created_at::text,
         resolved_at::text, resolved_by
       FROM evidence.workspace_comment WHERE workspace_id=CAST(:workspace_id AS uuid)
       ORDER BY created_at`,
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
    ),
    executeEvidenceSql(
      `SELECT id::text, section_key, question, assigned_to, status, created_by,
         created_at::text, completed_at::text
       FROM evidence.workspace_review_question
       WHERE workspace_id=CAST(:workspace_id AS uuid) ORDER BY created_at`,
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
    ),
    executeEvidenceSql(
      `SELECT id::text, section_key, content::text, status, created_at::text,
         reviewed_by, reviewed_at::text
       FROM evidence.agent_suggestion
       WHERE workspace_id=CAST(:workspace_id AS uuid) ORDER BY created_at`,
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
    ),
    executeEvidenceSql(
      `SELECT s.id::text, s.name, s.status, s.current_version, v.outputs::text,
         v.human_review_status, v.created_at::text
       FROM evidence.planning_scenario s
       JOIN evidence.planning_scenario_version v
         ON v.scenario_id=s.id AND v.version=s.current_version
       WHERE s.workspace_id=CAST(:workspace_id AS uuid) ORDER BY s.created_at`,
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
    ),
    executeEvidenceSql(
      `SELECT principal_id, role::text, access::text, display_name, joined_at::text
       FROM evidence.workspace_participant
       WHERE workspace_id=CAST(:workspace_id AS uuid) AND revoked_at IS NULL
       ORDER BY joined_at`,
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
    ),
  ]);
  const header = workspace.records?.[0];
  if (!header) throw new Error("The county workspace is unavailable.");
  return {
    workspace: {
      id: String(evidenceFieldValue(header[0]) ?? ""),
      title: String(evidenceFieldValue(header[1]) ?? ""),
      version: Number(evidenceFieldValue(header[2]) ?? 0),
      status: String(evidenceFieldValue(header[3]) ?? ""),
      updatedAt: String(evidenceFieldValue(header[4]) ?? ""),
      geoid: String(evidenceFieldValue(header[5]) ?? ""),
      geographyName: String(evidenceFieldValue(header[6]) ?? ""),
    },
    sections: (sections.records ?? []).map((row) => ({
      sectionKey: String(evidenceFieldValue(row[0]) ?? ""),
      version: Number(evidenceFieldValue(row[1]) ?? 0),
      content: JSON.parse(String(evidenceFieldValue(row[2]) ?? "{}")),
      updatedBy: String(evidenceFieldValue(row[3]) ?? ""),
      updatedAt: String(evidenceFieldValue(row[4]) ?? ""),
    })),
    comments: (comments.records ?? []).map((row) => ({
      id: String(evidenceFieldValue(row[0]) ?? ""),
      sectionKey: String(evidenceFieldValue(row[1]) ?? ""),
      actorId: String(evidenceFieldValue(row[2]) ?? ""),
      body: String(evidenceFieldValue(row[3]) ?? ""),
      createdAt: String(evidenceFieldValue(row[4]) ?? ""),
      resolvedAt: evidenceFieldValue(row[5]),
      resolvedBy: evidenceFieldValue(row[6]),
    })),
    reviewQuestions: (questions.records ?? []).map((row) => ({
      id: String(evidenceFieldValue(row[0]) ?? ""),
      sectionKey: String(evidenceFieldValue(row[1]) ?? ""),
      question: String(evidenceFieldValue(row[2]) ?? ""),
      assignedTo: evidenceFieldValue(row[3]),
      status: String(evidenceFieldValue(row[4]) ?? ""),
      createdBy: String(evidenceFieldValue(row[5]) ?? ""),
      createdAt: String(evidenceFieldValue(row[6]) ?? ""),
      completedAt: evidenceFieldValue(row[7]),
    })),
    suggestions: (suggestions.records ?? []).map((row) => ({
      id: String(evidenceFieldValue(row[0]) ?? ""),
      sectionKey: String(evidenceFieldValue(row[1]) ?? ""),
      content: JSON.parse(String(evidenceFieldValue(row[2]) ?? "{}")),
      status: String(evidenceFieldValue(row[3]) ?? ""),
      createdAt: String(evidenceFieldValue(row[4]) ?? ""),
      reviewedBy: evidenceFieldValue(row[5]),
      reviewedAt: evidenceFieldValue(row[6]),
    })),
    scenarios: (scenarios.records ?? []).map((row) => ({
      id: String(evidenceFieldValue(row[0]) ?? ""),
      name: String(evidenceFieldValue(row[1]) ?? ""),
      status: String(evidenceFieldValue(row[2]) ?? ""),
      version: Number(evidenceFieldValue(row[3]) ?? 0),
      output: JSON.parse(String(evidenceFieldValue(row[4]) ?? "{}")),
      humanReviewStatus: String(evidenceFieldValue(row[5]) ?? ""),
      createdAt: String(evidenceFieldValue(row[6]) ?? ""),
    })),
    participants: (participants.records ?? []).map((row) => ({
      principalId: String(evidenceFieldValue(row[0]) ?? ""),
      role: String(evidenceFieldValue(row[1]) ?? ""),
      access: String(evidenceFieldValue(row[2]) ?? ""),
      displayName: String(evidenceFieldValue(row[3]) ?? "Participant"),
      joinedAt: String(evidenceFieldValue(row[4]) ?? ""),
    })),
  };
}

export async function listCountyWorkspaces(input: { tenantId: string; actor: WorkspaceActor }) {
  const result = await executeEvidenceSql(
    `SELECT w.id::text, w.title, w.version, w.updated_at::text, g.authority_id, g.name,
       p.role::text, p.access::text
     FROM evidence.county_workspace w
     JOIN evidence.workspace_participant p ON p.workspace_id=w.id
     JOIN evidence.geography g ON g.id=w.geography_id
     WHERE w.tenant_id=CAST(:tenant_id AS uuid) AND p.principal_id=:principal_id
       AND p.revoked_at IS NULL AND w.status='active'
     ORDER BY w.updated_at DESC LIMIT 100`,
    [
      { name: "tenant_id", value: { stringValue: input.tenantId } },
      { name: "principal_id", value: { stringValue: input.actor.principalId } },
    ],
  );
  return (result.records ?? []).map((row) => ({
    id: String(evidenceFieldValue(row[0]) ?? ""), title: String(evidenceFieldValue(row[1]) ?? ""),
    version: Number(evidenceFieldValue(row[2]) ?? 0), updatedAt: String(evidenceFieldValue(row[3]) ?? ""),
    geoid: String(evidenceFieldValue(row[4]) ?? ""), geographyName: String(evidenceFieldValue(row[5]) ?? ""),
    role: String(evidenceFieldValue(row[6]) ?? ""), access: String(evidenceFieldValue(row[7]) ?? ""),
  }));
}

// Public bearer links use a separate projection.  The internal workspace
// model is intentionally never loaded by this path.
async function loadPublicWorkspacePlan(input: { workspaceId: string; tenantId: string }): Promise<PublicWorkspacePlan> {
  const publicSectionKeys = ["summary", "context", "evidence", "action", "measurements", "plan", "response-fit", "public-summary"];
  const sectionKeyPlaceholders = publicSectionKeys.map((_, index) => `:public_section_key_${index}`).join(", ");
  const [workspace, sections, scenarios, reviewQuestions] = await Promise.all([
    executeEvidenceSql(
      `SELECT w.title, w.version, w.updated_at::text, g.authority_id, g.name
       FROM evidence.county_workspace w
       JOIN evidence.geography g ON g.id=w.geography_id
       WHERE w.id=CAST(:workspace_id AS uuid) AND w.tenant_id=CAST(:tenant_id AS uuid)
         AND w.status='active'`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
      ],
    ),
    executeEvidenceSql(
      `SELECT section_key, version, content::text, updated_at::text
       FROM evidence.workspace_section
        WHERE workspace_id=CAST(:workspace_id AS uuid)
          AND section_key IN (${sectionKeyPlaceholders})
          AND content->>'public'='true'
          AND content->>'reviewStatus' IN ('verified', 'approved')
       ORDER BY section_key`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        ...publicSectionKeys.map((sectionKey, index) => ({
          name: `public_section_key_${index}`,
          value: { stringValue: sectionKey },
        })),
      ],
    ),
    executeEvidenceSql(
      `SELECT s.name, s.current_version, v.outputs::text, v.human_review_status, v.created_at::text
       FROM evidence.planning_scenario s
       JOIN evidence.planning_scenario_version v
         ON v.scenario_id=s.id AND v.version=s.current_version
       WHERE s.workspace_id=CAST(:workspace_id AS uuid)
         AND s.status='accepted' AND v.human_review_status='verified'
       ORDER BY s.created_at`,
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
    ),
    executeEvidenceSql(
      `SELECT section_key, question, status, completed_at::text, is_public
       FROM evidence.workspace_review_question
       WHERE workspace_id=CAST(:workspace_id AS uuid)
         AND is_public=true
         AND status IN ('answered', 'closed')
       ORDER BY created_at`,
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
    ),
  ]);
  const header = workspace.records?.[0];
  if (!header) throw new Error("The county workspace is unavailable.");
  return projectPublicWorkspacePlan({
    workspace: {
      title: String(evidenceFieldValue(header[0]) ?? ""),
      version: Number(evidenceFieldValue(header[1]) ?? 0),
      updatedAt: String(evidenceFieldValue(header[2]) ?? ""),
      geoid: String(evidenceFieldValue(header[3]) ?? ""),
      geographyName: String(evidenceFieldValue(header[4]) ?? ""),
    },
    sections: (sections.records ?? []).map((row) => ({
      sectionKey: String(evidenceFieldValue(row[0]) ?? ""),
      version: Number(evidenceFieldValue(row[1]) ?? 0),
      content: JSON.parse(String(evidenceFieldValue(row[2]) ?? "{}")) as Record<string, unknown>,
      updatedAt: String(evidenceFieldValue(row[3]) ?? ""),
    })),
    scenarios: (scenarios.records ?? []).map((row) => ({
      name: String(evidenceFieldValue(row[0]) ?? ""),
      version: Number(evidenceFieldValue(row[1]) ?? 0),
      output: JSON.parse(String(evidenceFieldValue(row[2]) ?? "{}")) as Record<string, unknown>,
      humanReviewStatus: String(evidenceFieldValue(row[3]) ?? ""),
      createdAt: String(evidenceFieldValue(row[4]) ?? ""),
    })),
    reviewQuestions: (reviewQuestions.records ?? []).map((row) => ({
      sectionKey: String(evidenceFieldValue(row[0]) ?? ""),
      question: String(evidenceFieldValue(row[1]) ?? ""),
      status: String(evidenceFieldValue(row[2]) ?? "closed") as "answered" | "closed",
      completedAt: evidenceFieldValue(row[3]) ? String(evidenceFieldValue(row[3])) : null,
      isPublic: evidenceFieldValue(row[4]) === true || String(evidenceFieldValue(row[4])) === "true",
    })),
  });
}

export async function getWorkspacePlan(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
}) {
  await requireWorkspaceMembership(input);
  return loadWorkspacePlan({ workspaceId: input.workspaceId, tenantId: input.tenantId });
}

export async function saveWorkspaceSection(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
  sectionKey: string;
  expectedVersion: number;
  content: Record<string, unknown>;
  idempotencyKey: string;
}) {
  if (!/^[a-z][a-z0-9_-]{1,63}$/.test(input.sectionKey)) {
    throw new Error("The plan section identifier is invalid.");
  }
  if (input.actor.actorType !== "human") {
    throw new Error("Agent suggestions require explicit human acceptance before entering the plan.");
  }
  const requestHash = sha256({ action: "save_section", sectionKey: input.sectionKey, expectedVersion: input.expectedVersion, content: input.content });
  return executeEvidenceTransaction(async (transactionId) => {
    await requireWorkspaceMembership({ ...input, write: true, transactionId });
    await executeEvidenceSql(
      `SELECT pg_advisory_xact_lock(hashtext(:workspace_section))`,
      [{
        name: "workspace_section",
        value: { stringValue: `${input.workspaceId}:${input.sectionKey}` },
      }],
      transactionId,
    );
    const prior = await findWorkspaceMutationEvent({ ...input, transactionId });
    if (prior) {
      const stored = await executeEvidenceSql(
        `SELECT version, content::text FROM evidence.workspace_section_version
         WHERE source_event_id=CAST(:event_id AS uuid)
           AND workspace_id=CAST(:workspace_id AS uuid)
           AND section_key=:section_key`,
        [
          { name: "event_id", value: { stringValue: prior.id } },
          { name: "workspace_id", value: { stringValue: input.workspaceId } },
          { name: "section_key", value: { stringValue: input.sectionKey } },
        ],
        transactionId,
      );
      const storedVersion = Number(evidenceFieldValue(stored.records?.[0]?.[0]) ?? 0);
      const storedContent = JSON.parse(String(evidenceFieldValue(stored.records?.[0]?.[1]) ?? "{}")) as Record<string, unknown>;
      const storedHash = sha256({ action: "save_section", sectionKey: input.sectionKey, expectedVersion: storedVersion - 1, content: storedContent });
      if (prior.eventType !== "result_added_to_plan" || storedHash !== requestHash) {
        throw new Error("The idempotency key is already bound to a different workspace mutation.");
      }
      return { sectionKey: input.sectionKey, version: storedVersion, content: storedContent, event: prior };
    }
    const current = await executeEvidenceSql(
      `SELECT version FROM evidence.workspace_section
       WHERE workspace_id=CAST(:workspace_id AS uuid) AND section_key=:section_key`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "section_key", value: { stringValue: input.sectionKey } },
      ],
      transactionId,
    );
    const currentVersion = Number(evidenceFieldValue(current.records?.[0]?.[0]) ?? 0);
    if (currentVersion !== input.expectedVersion) {
      const conflict = new Error("This plan section changed after it was opened. Review the latest version before saving.");
      conflict.name = "WorkspaceVersionConflict";
      throw conflict;
    }
    const event = await appendWorkspaceEvent({
      workspaceId: input.workspaceId,
      tenantId: input.tenantId,
      eventType: "result_added_to_plan",
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      evidenceSnapshotId: null,
      requestHash,
      payload: { sectionKey: input.sectionKey, fromVersion: currentVersion, toVersion: currentVersion + 1, requestHash },
      transactionId,
    });
    const nextVersion = currentVersion + 1;
    await executeEvidenceSql(
      `INSERT INTO evidence.workspace_section (
         workspace_id, section_key, version, content, updated_by, updated_at
       ) VALUES (
         CAST(:workspace_id AS uuid), :section_key, :version, CAST(:content AS jsonb),
         :updated_by, now()
       )
       ON CONFLICT (workspace_id, section_key) DO UPDATE SET
         version=EXCLUDED.version, content=EXCLUDED.content,
         updated_by=EXCLUDED.updated_by, updated_at=EXCLUDED.updated_at`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "section_key", value: { stringValue: input.sectionKey } },
        { name: "version", value: { longValue: nextVersion } },
        { name: "content", value: { stringValue: JSON.stringify(input.content) } },
        { name: "updated_by", value: { stringValue: input.actor.principalId } },
      ],
      transactionId,
    );
    await executeEvidenceSql(
      `INSERT INTO evidence.workspace_section_version (
         id, workspace_id, section_key, version, content, actor_type,
         actor_id, source_event_id, created_at
       ) VALUES (
         CAST(:id AS uuid), CAST(:workspace_id AS uuid), :section_key, :version,
         CAST(:content AS jsonb), 'human', :actor_id, CAST(:event_id AS uuid), now()
       )`,
      [
        { name: "id", value: { stringValue: randomUUID() } },
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "section_key", value: { stringValue: input.sectionKey } },
        { name: "version", value: { longValue: nextVersion } },
        { name: "content", value: { stringValue: JSON.stringify(input.content) } },
        { name: "actor_id", value: { stringValue: input.actor.principalId } },
        { name: "event_id", value: { stringValue: event.id } },
      ],
      transactionId,
    );
    await executeEvidenceSql(
      `UPDATE evidence.county_workspace
       SET version=version + 1, updated_at=now()
       WHERE id=CAST(:workspace_id AS uuid) AND tenant_id=CAST(:tenant_id AS uuid)`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
      ],
      transactionId,
    );
    return { sectionKey: input.sectionKey, version: nextVersion, content: input.content, event };
  });
}

export async function addWorkspaceComment(input: {
  workspaceId: string; tenantId: string; actor: WorkspaceActor; sectionKey: string;
  body: string; idempotencyKey: string;
}) {
  if (input.actor.actorType !== "human") throw new Error("Only a human participant may add a comment.");
  if (!/^[a-z][a-z0-9_-]{1,63}$/.test(input.sectionKey) || !input.body.trim() || input.body.length > 4_000) throw new Error("The comment is invalid.");
  const normalizedBody = input.body.trim();
  const requestHash = sha256({ action: "comment", sectionKey: input.sectionKey, body: normalizedBody });
  return executeEvidenceTransaction(async (transactionId) => {
    await requireWorkspaceMembership({ ...input, write: true, transactionId });
    await executeEvidenceSql("SELECT pg_advisory_xact_lock(hashtext(:workspace_id))", [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
    ], transactionId);
    const prior = await findWorkspaceMutationEvent({ ...input, transactionId });
    if (prior) {
      const commentId = String(prior.payload.commentId ?? "");
      const stored = await executeEvidenceSql(
        `SELECT section_key, body FROM evidence.workspace_comment
         WHERE id=CAST(:id AS uuid) AND workspace_id=CAST(:workspace_id AS uuid)`,
        [
          { name: "id", value: { stringValue: commentId } },
          { name: "workspace_id", value: { stringValue: input.workspaceId } },
        ],
        transactionId,
      );
      const storedSection = String(evidenceFieldValue(stored.records?.[0]?.[0]) ?? "");
      const storedBody = String(evidenceFieldValue(stored.records?.[0]?.[1]) ?? "");
      const storedHash = sha256({ action: "comment", sectionKey: storedSection, body: storedBody });
      if (prior.eventType !== "question_asked" || prior.payload.kind !== "comment" || storedHash !== requestHash) {
        throw new Error("The idempotency key is already bound to a different workspace mutation.");
      }
      return { id: commentId, sectionKey: storedSection, body: storedBody, event: prior };
    }
    const id = randomUUID();
    await executeEvidenceSql(`INSERT INTO evidence.workspace_comment (id, workspace_id, section_key, actor_id, body, created_at) VALUES (CAST(:id AS uuid), CAST(:workspace_id AS uuid), :section_key, :actor_id, :body, now())`, [
      { name: "id", value: { stringValue: id } }, { name: "workspace_id", value: { stringValue: input.workspaceId } },
      { name: "section_key", value: { stringValue: input.sectionKey } }, { name: "actor_id", value: { stringValue: input.actor.principalId } },
      { name: "body", value: { stringValue: normalizedBody } },
    ], transactionId);
    const event = await appendWorkspaceEvent({ workspaceId: input.workspaceId, tenantId: input.tenantId, eventType: "question_asked", actor: input.actor, idempotencyKey: input.idempotencyKey, evidenceSnapshotId: null, requestHash, payload: { commentId: id, sectionKey: input.sectionKey, kind: "comment", requestHash }, transactionId });
    return { id, sectionKey: input.sectionKey, body: normalizedBody, event };
  });
}

export async function addWorkspaceReviewQuestion(input: {
  workspaceId: string; tenantId: string; actor: WorkspaceActor; sectionKey: string;
  question: string; assignedTo: string | null; isPublic: boolean; idempotencyKey: string;
}) {
  if (input.actor.actorType !== "human") throw new Error("Only a human participant may assign a review question.");
  if (!/^[a-z][a-z0-9_-]{1,63}$/.test(input.sectionKey) || input.question.trim().length < 3 || input.question.length > 2_000) throw new Error("The review question is invalid.");
  const normalizedQuestion = input.question.trim();
  const requestHash = sha256({ action: "review_question", sectionKey: input.sectionKey, question: normalizedQuestion, assignedTo: input.assignedTo, isPublic: input.isPublic });
  return executeEvidenceTransaction(async (transactionId) => {
    await requireWorkspaceMembership({ ...input, write: true, transactionId });
    await executeEvidenceSql("SELECT pg_advisory_xact_lock(hashtext(:workspace_id))", [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
    ], transactionId);
    const prior = await findWorkspaceMutationEvent({ ...input, transactionId });
    if (prior) {
      const reviewQuestionId = String(prior.payload.reviewQuestionId ?? "");
      const stored = await executeEvidenceSql(
        `SELECT section_key, question, assigned_to, is_public, status
         FROM evidence.workspace_review_question
         WHERE id=CAST(:id AS uuid) AND workspace_id=CAST(:workspace_id AS uuid)`,
        [
          { name: "id", value: { stringValue: reviewQuestionId } },
          { name: "workspace_id", value: { stringValue: input.workspaceId } },
        ],
        transactionId,
      );
      const row = stored.records?.[0];
      const storedSection = String(evidenceFieldValue(row?.[0]) ?? "");
      const storedQuestion = String(evidenceFieldValue(row?.[1]) ?? "");
      const storedAssignedTo = evidenceFieldValue(row?.[2]) ? String(evidenceFieldValue(row?.[2])) : null;
      const storedPublic = evidenceFieldValue(row?.[3]) === true || String(evidenceFieldValue(row?.[3])) === "true";
      const storedHash = sha256({ action: "review_question", sectionKey: storedSection, question: storedQuestion, assignedTo: storedAssignedTo, isPublic: storedPublic });
      if (prior.eventType !== "human_review_requested" || storedHash !== requestHash) {
        throw new Error("The idempotency key is already bound to a different workspace mutation.");
      }
      return { id: reviewQuestionId, sectionKey: storedSection, question: storedQuestion, status: String(evidenceFieldValue(row?.[4]) ?? "open"), event: prior };
    }
    const id = randomUUID();
    await executeEvidenceSql(`INSERT INTO evidence.workspace_review_question (id, workspace_id, section_key, question, assigned_to, status, created_by, created_at, is_public) VALUES (CAST(:id AS uuid), CAST(:workspace_id AS uuid), :section_key, :question, :assigned_to, 'open', :created_by, now(), :is_public)`, [
      { name: "id", value: { stringValue: id } }, { name: "workspace_id", value: { stringValue: input.workspaceId } }, { name: "section_key", value: { stringValue: input.sectionKey } },
      { name: "question", value: { stringValue: normalizedQuestion } }, input.assignedTo ? { name: "assigned_to", value: { stringValue: input.assignedTo } } : { name: "assigned_to", value: { isNull: true } },
      { name: "created_by", value: { stringValue: input.actor.principalId } }, { name: "is_public", value: { booleanValue: input.isPublic } },
    ], transactionId);
    const event = await appendWorkspaceEvent({ workspaceId: input.workspaceId, tenantId: input.tenantId, eventType: "human_review_requested", actor: input.actor, idempotencyKey: input.idempotencyKey, evidenceSnapshotId: null, requestHash, payload: { reviewQuestionId: id, sectionKey: input.sectionKey, assignedTo: input.assignedTo, isPublic: input.isPublic, requestHash }, transactionId });
    return { id, sectionKey: input.sectionKey, question: normalizedQuestion, status: "open", event };
  });
}

export async function completeWorkspaceReviewQuestion(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
  reviewQuestionId: string;
  status: "answered" | "closed";
  idempotencyKey: string;
}) {
  if (input.actor.actorType !== "human") throw new Error("Only an authorized human reviewer may complete a review question.");
  return executeEvidenceTransaction(async (transactionId) => {
    await requireWorkspaceMembership({ ...input, write: true, transactionId });
    await executeEvidenceSql("SELECT pg_advisory_xact_lock(hashtext(:workspace_id))", [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
    ], transactionId);
    const prior = await findWorkspaceMutationEvent({ ...input, transactionId });
    if (prior) {
      if (prior.eventType !== "human_review_completed"
        || prior.payload.reviewQuestionId !== input.reviewQuestionId
        || prior.payload.status !== input.status) {
        throw new Error("The idempotency key is already bound to a different workspace mutation.");
      }
      return { id: input.reviewQuestionId, status: input.status, event: prior };
    }
    const updated = await executeEvidenceSql(
      `UPDATE evidence.workspace_review_question
       SET status=:status, completed_at=now()
       WHERE id=CAST(:id AS uuid) AND workspace_id=CAST(:workspace_id AS uuid)
         AND status='open'
       RETURNING section_key, is_public`,
      [
        { name: "status", value: { stringValue: input.status } },
        { name: "id", value: { stringValue: input.reviewQuestionId } },
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
      ],
      transactionId,
    );
    const row = updated.records?.[0];
    if (!row) throw new Error("The review question is unavailable or already completed.");
    const sectionKey = String(evidenceFieldValue(row[0]) ?? "plan");
    const isPublic = evidenceFieldValue(row[1]) === true || String(evidenceFieldValue(row[1])) === "true";
    const event = await appendWorkspaceEvent({
      workspaceId: input.workspaceId,
      tenantId: input.tenantId,
      eventType: "human_review_completed",
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      evidenceSnapshotId: null,
      payload: { reviewQuestionId: input.reviewQuestionId, sectionKey, status: input.status, isPublic },
      transactionId,
    });
    return { id: input.reviewQuestionId, sectionKey, status: input.status, isPublic, event };
  });
}

export async function createWorkspaceAgentSuggestion(input: {
  workspaceId: string; tenantId: string; requestingActor: WorkspaceActor; sectionKey: string;
  content: Record<string, unknown>; executionAuditId?: string | null; idempotencyKey: string;
}) {
  if (!/^[a-z][a-z0-9_-]{1,63}$/.test(input.sectionKey)) throw new Error("The suggestion section is invalid.");
  const requestHash = sha256({ action: "agent_suggestion", sectionKey: input.sectionKey, content: input.content });
  return executeEvidenceTransaction(async (transactionId) => {
    await requireWorkspaceMembership({ workspaceId: input.workspaceId, tenantId: input.tenantId, actor: input.requestingActor, write: true, transactionId });
    await executeEvidenceSql("SELECT pg_advisory_xact_lock(hashtext(:workspace_id))", [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
    ], transactionId);
    const prior = await findWorkspaceMutationEvent({ workspaceId: input.workspaceId, tenantId: input.tenantId, idempotencyKey: input.idempotencyKey, transactionId });
    if (prior) {
      const suggestionId = String(prior.payload.suggestionId ?? "");
      const stored = await executeEvidenceSql(
        `SELECT section_key, content::text, status FROM evidence.agent_suggestion
         WHERE id=CAST(:id AS uuid) AND workspace_id=CAST(:workspace_id AS uuid)`,
        [
          { name: "id", value: { stringValue: suggestionId } },
          { name: "workspace_id", value: { stringValue: input.workspaceId } },
        ],
        transactionId,
      );
      const row = stored.records?.[0];
      const sectionKey = String(evidenceFieldValue(row?.[0]) ?? "");
      const content = JSON.parse(String(evidenceFieldValue(row?.[1]) ?? "{}")) as Record<string, unknown>;
      const storedHash = sha256({ action: "agent_suggestion", sectionKey, content });
      if (prior.eventType !== "agent_claim_validated" || storedHash !== requestHash) {
        throw new Error("The idempotency key is already bound to a different workspace mutation.");
      }
      return { id: suggestionId, sectionKey, content, status: String(evidenceFieldValue(row?.[2]) ?? "pending"), event: prior };
    }
    const id = randomUUID();
    await executeEvidenceSql(`INSERT INTO evidence.agent_suggestion (id, workspace_id, section_key, execution_audit_id, content, status, created_at) VALUES (CAST(:id AS uuid), CAST(:workspace_id AS uuid), :section_key, NULLIF(:audit_id, '')::uuid, CAST(:content AS jsonb), 'pending', now())`, [
      { name: "id", value: { stringValue: id } }, { name: "workspace_id", value: { stringValue: input.workspaceId } }, { name: "section_key", value: { stringValue: input.sectionKey } },
      { name: "audit_id", value: { stringValue: input.executionAuditId ?? "" } }, { name: "content", value: { stringValue: JSON.stringify(input.content) } },
    ], transactionId);
    const agent: WorkspaceActor = { principalId: "sozorock-place-agent", actorType: "agent", role: "evidence_agent", access: "contributor", displayName: "SozoRock Place Intelligence" };
    const event = await appendWorkspaceEvent({ workspaceId: input.workspaceId, tenantId: input.tenantId, eventType: "agent_claim_validated", actor: agent, idempotencyKey: input.idempotencyKey, evidenceSnapshotId: null, requestHash, payload: { suggestionId: id, sectionKey: input.sectionKey, status: "pending", requestHash }, transactionId });
    return { id, sectionKey: input.sectionKey, content: input.content, status: "pending", event };
  });
}

export async function reviewWorkspaceAgentSuggestion(input: {
  workspaceId: string; tenantId: string; actor: WorkspaceActor; suggestionId: string;
  decision: "accepted" | "rejected"; expectedSectionVersion: number; idempotencyKey: string;
}) {
  if (input.actor.actorType !== "human") throw new Error("Agent suggestions require an authorized human decision.");
  return executeEvidenceTransaction(async (transactionId) => {
    await requireWorkspaceMembership({ ...input, write: true, transactionId });
    await executeEvidenceSql("SELECT pg_advisory_xact_lock(hashtext(:workspace_id))", [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
    ], transactionId);
    const prior = await findWorkspaceMutationEvent({ ...input, transactionId });
    if (prior) {
      if (prior.eventType !== "human_review_completed"
        || prior.payload.suggestionId !== input.suggestionId
        || prior.payload.decision !== input.decision) {
        throw new Error("The idempotency key is already bound to a different workspace mutation.");
      }
      return {
        id: input.suggestionId,
        sectionKey: String(prior.payload.sectionKey ?? ""),
        status: input.decision,
        enteredPlan: prior.payload.enteredPlan === true,
        event: prior,
      };
    }
    const selected = await executeEvidenceSql(`SELECT section_key, content::text, status FROM evidence.agent_suggestion WHERE id=CAST(:id AS uuid) AND workspace_id=CAST(:workspace_id AS uuid) FOR UPDATE`, [
      { name: "id", value: { stringValue: input.suggestionId } }, { name: "workspace_id", value: { stringValue: input.workspaceId } },
    ], transactionId);
    const row = selected.records?.[0];
    if (!row || String(evidenceFieldValue(row[2])) !== "pending") throw new Error("The agent suggestion is unavailable or already reviewed.");
    const sectionKey = String(evidenceFieldValue(row[0]) ?? "");
    const content = JSON.parse(String(evidenceFieldValue(row[1]) ?? "{}")) as Record<string, unknown>;
    await executeEvidenceSql(`UPDATE evidence.agent_suggestion SET status=:decision, reviewed_by=:reviewer, reviewed_at=now() WHERE id=CAST(:id AS uuid) AND status='pending'`, [
      { name: "decision", value: { stringValue: input.decision } }, { name: "reviewer", value: { stringValue: input.actor.principalId } }, { name: "id", value: { stringValue: input.suggestionId } },
    ], transactionId);
    let event: Awaited<ReturnType<typeof appendWorkspaceEvent>>;
    if (input.decision === "accepted") {
      await executeEvidenceSql(
        `SELECT pg_advisory_xact_lock(hashtext(:workspace_section))`,
        [{ name: "workspace_section", value: { stringValue: `${input.workspaceId}:${sectionKey}` } }],
        transactionId,
      );
      const current = await executeEvidenceSql(`SELECT version FROM evidence.workspace_section WHERE workspace_id=CAST(:workspace_id AS uuid) AND section_key=:section_key`, [
        { name: "workspace_id", value: { stringValue: input.workspaceId } }, { name: "section_key", value: { stringValue: sectionKey } },
      ], transactionId);
      const version = Number(evidenceFieldValue(current.records?.[0]?.[0]) ?? 0);
      if (version !== input.expectedSectionVersion) throw new Error("This plan section changed. Review the current version before accepting the suggestion.");
      event = await appendWorkspaceEvent({
        workspaceId: input.workspaceId,
        tenantId: input.tenantId,
        eventType: "human_review_completed",
        actor: input.actor,
        idempotencyKey: input.idempotencyKey,
        evidenceSnapshotId: null,
        payload: { suggestionId: input.suggestionId, sectionKey, decision: input.decision, enteredPlan: true, fromVersion: version, toVersion: version + 1 },
        transactionId,
      });
      await executeEvidenceSql(`INSERT INTO evidence.workspace_section (workspace_id, section_key, version, content, updated_by, updated_at) VALUES (CAST(:workspace_id AS uuid), :section_key, :version, CAST(:content AS jsonb), :updated_by, now()) ON CONFLICT (workspace_id, section_key) DO UPDATE SET version=EXCLUDED.version, content=EXCLUDED.content, updated_by=EXCLUDED.updated_by, updated_at=EXCLUDED.updated_at`, [
        { name: "workspace_id", value: { stringValue: input.workspaceId } }, { name: "section_key", value: { stringValue: sectionKey } }, { name: "version", value: { longValue: version + 1 } }, { name: "content", value: { stringValue: JSON.stringify(content) } }, { name: "updated_by", value: { stringValue: input.actor.principalId } },
      ], transactionId);
      await executeEvidenceSql(
        `INSERT INTO evidence.workspace_section_version (
           id, workspace_id, section_key, version, content, actor_type,
           actor_id, source_event_id, created_at
         ) VALUES (
           CAST(:id AS uuid), CAST(:workspace_id AS uuid), :section_key, :version,
           CAST(:content AS jsonb), 'human', :actor_id, CAST(:event_id AS uuid), now()
         )`,
        [
          { name: "id", value: { stringValue: randomUUID() } },
          { name: "workspace_id", value: { stringValue: input.workspaceId } },
          { name: "section_key", value: { stringValue: sectionKey } },
          { name: "version", value: { longValue: version + 1 } },
          { name: "content", value: { stringValue: JSON.stringify(content) } },
          { name: "actor_id", value: { stringValue: input.actor.principalId } },
          { name: "event_id", value: { stringValue: event.id } },
        ],
        transactionId,
      );
      await executeEvidenceSql(
        `UPDATE evidence.county_workspace
         SET version=version + 1, updated_at=now()
         WHERE id=CAST(:workspace_id AS uuid) AND tenant_id=CAST(:tenant_id AS uuid)`,
        [
          { name: "workspace_id", value: { stringValue: input.workspaceId } },
          { name: "tenant_id", value: { stringValue: input.tenantId } },
        ],
        transactionId,
      );
    } else {
      event = await appendWorkspaceEvent({ workspaceId: input.workspaceId, tenantId: input.tenantId, eventType: "human_review_completed", actor: input.actor, idempotencyKey: input.idempotencyKey, evidenceSnapshotId: null, payload: { suggestionId: input.suggestionId, sectionKey, decision: input.decision, enteredPlan: false }, transactionId });
    }
    return { id: input.suggestionId, sectionKey, status: input.decision, enteredPlan: input.decision === "accepted", event };
  });
}

export async function createWorkspaceInvitation(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
  role: Exclude<WorkspaceRole, "evidence_agent">;
  access: Exclude<WorkspaceAccess, "owner">;
  intendedPrincipalId?: string;
}) {
  if (input.actor.actorType !== "human") {
    throw new Error("Only a human workspace owner may create an invitation.");
  }
  await requireWorkspaceMembership({ ...input, write: true, allowedAccess: ["owner"] });
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  await executeEvidenceSql(
    `INSERT INTO evidence.workspace_invitation (
       id, workspace_id, token_hash, role, access, invited_by, intended_principal_id, expires_at, created_at
     ) VALUES (
       CAST(:id AS uuid), CAST(:workspace_id AS uuid), :token_hash,
       CAST(:role AS evidence.workspace_role), CAST(:access AS evidence.workspace_access),
       :invited_by, :intended_principal_id, now() + interval '7 days', now()
     )`,
    [
      { name: "id", value: { stringValue: id } },
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
      { name: "token_hash", value: { stringValue: sha256(token) } },
      { name: "role", value: { stringValue: input.role } },
      { name: "access", value: { stringValue: input.access } },
      { name: "invited_by", value: { stringValue: input.actor.principalId } },
      input.intendedPrincipalId
        ? { name: "intended_principal_id", value: { stringValue: input.intendedPrincipalId } }
        : { name: "intended_principal_id", value: { isNull: true } },
    ],
  );
  return { id, token, expiresInSeconds: 604_800, role: input.role, access: input.access };
}

export async function acceptWorkspaceInvitation(input: {
  token: string;
  tenantId: string;
  actor: WorkspaceActor;
  idempotencyKey: string;
}) {
  if (input.actor.actorType !== "human") {
    throw new Error("Only an authenticated human participant may accept an invitation.");
  }
  return executeEvidenceTransaction(async (transactionId) => {
    const invitation = await executeEvidenceSql(
      `SELECT i.id::text, i.workspace_id::text, i.role::text, i.access::text,
              i.intended_principal_id
       FROM evidence.workspace_invitation i
       JOIN evidence.county_workspace w ON w.id=i.workspace_id
       WHERE i.token_hash=:token_hash
         AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
         AND (i.intended_principal_id IS NULL OR i.intended_principal_id=:principal_id)
         AND w.tenant_id=CAST(:tenant_id AS uuid) AND w.status='active'
       FOR UPDATE`,
      [
        { name: "token_hash", value: { stringValue: sha256(input.token) } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
        { name: "principal_id", value: { stringValue: input.actor.principalId } },
      ],
      transactionId,
    );
    const row = invitation.records?.[0];
    if (!row) throw new Error("This workspace invitation is invalid, expired, or outside your organization.");
    const invitationId = String(evidenceFieldValue(row[0]) ?? "");
    const workspaceId = String(evidenceFieldValue(row[1]) ?? "");
    const role = String(evidenceFieldValue(row[2]) ?? "");
    const access = String(evidenceFieldValue(row[3]) ?? "");
    const intendedPrincipalId = evidenceFieldValue(row[4]);
    if (intendedPrincipalId && String(intendedPrincipalId) !== input.actor.principalId) {
      throw new Error("This invitation is bound to a different participant.");
    }
    await executeEvidenceSql(
      `INSERT INTO evidence.workspace_participant (
         workspace_id, principal_id, role, access, display_name, joined_at
       ) VALUES (
         CAST(:workspace_id AS uuid), :principal_id, CAST(:role AS evidence.workspace_role),
         CAST(:access AS evidence.workspace_access), :display_name, now()
       )
       ON CONFLICT (workspace_id, principal_id) DO UPDATE SET
         revoked_at=NULL, role=EXCLUDED.role, access=EXCLUDED.access,
         display_name=EXCLUDED.display_name`,
      [
        { name: "workspace_id", value: { stringValue: workspaceId } },
        { name: "principal_id", value: { stringValue: input.actor.principalId } },
        { name: "role", value: { stringValue: role } },
        { name: "access", value: { stringValue: access } },
        { name: "display_name", value: { stringValue: input.actor.displayName } },
      ],
      transactionId,
    );
    await executeEvidenceSql(
      `UPDATE evidence.workspace_invitation
       SET accepted_by=:principal_id, accepted_at=now()
       WHERE id=CAST(:id AS uuid) AND accepted_at IS NULL`,
      [
        { name: "id", value: { stringValue: invitationId } },
        { name: "principal_id", value: { stringValue: input.actor.principalId } },
      ],
      transactionId,
    );
    const authorizedActor: WorkspaceActor = {
      ...input.actor,
      role: role as WorkspaceRole,
      access: access as WorkspaceAccess,
    };
    const event = await appendTrustedMembershipEvent({
      workspaceId,
      tenantId: input.tenantId,
      eventType: "participant_joined",
      actor: authorizedActor,
      idempotencyKey: input.idempotencyKey,
      evidenceSnapshotId: null,
      payload: { role, access },
      transactionId,
    });
    return { workspaceId, role, access, event };
  });
}

export async function createWorkspaceShareLink(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
  scope: "read_only";
  expiresInHours?: number;
}) {
  if (input.actor.actorType !== "human") {
    throw new Error("Only a human workspace owner may create a share link.");
  }
  await requireWorkspaceMembership({ ...input, write: true, allowedAccess: ["owner"] });
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  const hours = Math.max(1, Math.min(168, Math.floor(input.expiresInHours ?? 72)));
  await executeEvidenceSql(
    `INSERT INTO evidence.workspace_share_link (
       id, workspace_id, tenant_id, token_hash, scope, expires_at, created_by
     ) VALUES (
       CAST(:id AS uuid), CAST(:workspace_id AS uuid), CAST(:tenant_id AS uuid),
       :token_hash, :scope, now() + (:hours * interval '1 hour'), :created_by
     )`,
    [
      { name: "id", value: { stringValue: id } },
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
      { name: "tenant_id", value: { stringValue: input.tenantId } },
      { name: "token_hash", value: { stringValue: hashOpaqueToken(token) } },
      { name: "scope", value: { stringValue: input.scope } },
      { name: "hours", value: { longValue: hours } },
      { name: "created_by", value: { stringValue: input.actor.principalId } },
    ],
  );
  await executeEvidenceSql(
    `UPDATE evidence.county_workspace SET share_mode='shared'
     WHERE id=CAST(:workspace_id AS uuid) AND tenant_id=CAST(:tenant_id AS uuid)`,
    [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
      { name: "tenant_id", value: { stringValue: input.tenantId } },
    ],
  );
  await appendWorkspaceEvent({
    workspaceId: input.workspaceId,
    tenantId: input.tenantId,
    eventType: "workspace_shared",
    actor: input.actor,
    idempotencyKey: `workspace-shared:${id}`,
    evidenceSnapshotId: null,
    payload: { shareLinkId: id, scope: input.scope, expiresInHours: hours },
  });
  return { id, token, scope: input.scope, expiresInHours: hours };
}

export async function listWorkspaceShareLinks(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
}) {
  if (input.actor.actorType !== "human") {
    throw new Error("Only a human workspace owner may review share links.");
  }
  await requireWorkspaceMembership({ ...input, write: true, allowedAccess: ["owner"] });
  const result = await executeEvidenceSql(
    `SELECT id::text, scope, expires_at::text, created_at::text, last_access_at::text
     FROM evidence.workspace_share_link
     WHERE workspace_id=CAST(:workspace_id AS uuid)
       AND tenant_id=CAST(:tenant_id AS uuid)
       AND revoked_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC`,
    [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
      { name: "tenant_id", value: { stringValue: input.tenantId } },
    ],
  );
  return (result.records ?? []).map((row) => ({
    id: String(evidenceFieldValue(row[0]) ?? ""),
    scope: String(evidenceFieldValue(row[1]) ?? "read_only"),
    expiresAt: String(evidenceFieldValue(row[2]) ?? ""),
    createdAt: String(evidenceFieldValue(row[3]) ?? ""),
    lastAccessAt: evidenceFieldValue(row[4]) ? String(evidenceFieldValue(row[4])) : null,
  }));
}

export async function revokeWorkspaceShareLink(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
  shareId: string;
  idempotencyKey: string;
}) {
  if (input.actor.actorType !== "human") {
    throw new Error("Only a human workspace owner may revoke a share link.");
  }
  return executeEvidenceTransaction(async (transactionId) => {
    await requireWorkspaceMembership({ ...input, write: true, allowedAccess: ["owner"], transactionId });
    const revoked = await executeEvidenceSql(
      `UPDATE evidence.workspace_share_link SET revoked_at=now()
       WHERE id=CAST(:share_id AS uuid) AND workspace_id=CAST(:workspace_id AS uuid)
         AND tenant_id=CAST(:tenant_id AS uuid) AND revoked_at IS NULL
       RETURNING id::text`,
      [
        { name: "share_id", value: { stringValue: input.shareId } },
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
      ],
      transactionId,
    );
    if (!revoked.records?.[0]) throw new Error("The share link is unavailable or already revoked.");
    await executeEvidenceSql(
      `UPDATE evidence.county_workspace SET share_mode='private'
       WHERE id=CAST(:workspace_id AS uuid) AND tenant_id=CAST(:tenant_id AS uuid)
         AND NOT EXISTS (
           SELECT 1 FROM evidence.workspace_share_link
           WHERE workspace_id=CAST(:workspace_id AS uuid)
             AND tenant_id=CAST(:tenant_id AS uuid)
             AND revoked_at IS NULL AND expires_at > now()
         )`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
      ],
      transactionId,
    );
    const event = await appendWorkspaceEvent({
      workspaceId: input.workspaceId,
      tenantId: input.tenantId,
      eventType: "workspace_shared",
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      evidenceSnapshotId: null,
      payload: { shareLinkId: input.shareId, action: "revoked" },
      outcome: "recorded",
      transactionId,
    });
    return { id: input.shareId, revoked: true, event };
  });
}

export async function getWorkspaceAudit(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
}) {
  await requireWorkspaceMembership({ ...input, write: false, allowedAccess: ["owner"], allowedRoles: ["foundation_reviewer"] });
  if (input.actor.actorType !== "human") {
    throw new Error("Only a workspace owner or Foundation reviewer may view the audit history.");
  }
  const [events, executions] = await Promise.all([
    executeEvidenceSql(
      `SELECT sequence_number, event_type::text, actor_type::text, actor_id,
         evidence_snapshot_id::text, policy_version, model_version, prompt_version,
         tool_name, request_hash, response_hash, outcome, occurred_at::text,
         idempotency_key, payload::text
       FROM evidence.workspace_event
       WHERE workspace_id=CAST(:workspace_id AS uuid) AND tenant_id=CAST(:tenant_id AS uuid)
       ORDER BY sequence_number DESC LIMIT 500`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
      ],
    ),
    executeEvidenceSql(
      `SELECT execution_type, contract_version, policy_version, snapshot_id::text,
         request_hash, response_hash, outcome, reason, occurred_at::text,
         metadata->>'model' AS model, metadata->>'provider' AS provider
       FROM evidence.execution_audit
       WHERE metadata->>'workspaceId'=:workspace_id
       ORDER BY occurred_at DESC LIMIT 250`,
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
    ),
  ]);
  return {
    workspaceEvents: (events.records ?? []).map((row) => ({
      sequenceNumber: Number(evidenceFieldValue(row[0]) ?? 0), eventType: String(evidenceFieldValue(row[1]) ?? ""),
      actorType: String(evidenceFieldValue(row[2]) ?? ""), actorReference: String(evidenceFieldValue(row[3]) ?? ""),
      evidenceSnapshotId: evidenceFieldValue(row[4]) ? String(evidenceFieldValue(row[4])) : null,
      policyVersion: String(evidenceFieldValue(row[5]) ?? ""), modelVersion: evidenceFieldValue(row[6]) ? String(evidenceFieldValue(row[6])) : null,
      promptVersion: evidenceFieldValue(row[7]) ? String(evidenceFieldValue(row[7])) : null, toolName: evidenceFieldValue(row[8]) ? String(evidenceFieldValue(row[8])) : null,
      requestHash: evidenceFieldValue(row[9]) ? String(evidenceFieldValue(row[9])) : null, responseHash: evidenceFieldValue(row[10]) ? String(evidenceFieldValue(row[10])) : null,
      outcome: String(evidenceFieldValue(row[11]) ?? ""), occurredAt: String(evidenceFieldValue(row[12]) ?? ""),
      idempotencyKey: String(evidenceFieldValue(row[13]) ?? ""), payload: JSON.parse(String(evidenceFieldValue(row[14]) ?? "{}")),
    })),
    agentExecutions: (executions.records ?? []).map((row) => ({
      executionType: String(evidenceFieldValue(row[0]) ?? ""), contractVersion: String(evidenceFieldValue(row[1]) ?? ""),
      policyVersion: String(evidenceFieldValue(row[2]) ?? ""), evidenceSnapshotId: evidenceFieldValue(row[3]) ? String(evidenceFieldValue(row[3])) : null,
      requestHash: String(evidenceFieldValue(row[4]) ?? ""), responseHash: evidenceFieldValue(row[5]) ? String(evidenceFieldValue(row[5])) : null,
      outcome: String(evidenceFieldValue(row[6]) ?? ""), reason: String(evidenceFieldValue(row[7]) ?? ""), occurredAt: String(evidenceFieldValue(row[8]) ?? ""),
      model: evidenceFieldValue(row[9]) ? String(evidenceFieldValue(row[9])) : null, provider: evidenceFieldValue(row[10]) ? String(evidenceFieldValue(row[10])) : null,
    })),
  };
}

export async function readWorkspaceShareLink(input: { token: string }) {
  if (input.token.length < 32 || input.token.length > 160) throw new Error("Share token is invalid.");
  const result = await executeEvidenceSql(
    `SELECT l.id::text, l.workspace_id::text, l.scope, l.expires_at::text,
       w.tenant_id::text, w.title, g.authority_id, g.name
     FROM evidence.workspace_share_link l
     JOIN evidence.county_workspace w ON w.id=l.workspace_id
     JOIN evidence.geography g ON g.id=w.geography_id
     WHERE l.token_hash=:token_hash AND l.scope='read_only'
       AND l.revoked_at IS NULL AND l.expires_at > now()
       AND w.status='active'`,
    [{ name: "token_hash", value: { stringValue: hashOpaqueToken(input.token) } }],
  );
  const row = result.records?.[0];
  if (!row) throw new Error("This share link is invalid, expired, or revoked.");
  await executeEvidenceSql(
    `UPDATE evidence.workspace_share_link SET last_access_at=now()
     WHERE id=CAST(:id AS uuid) AND revoked_at IS NULL`,
    [{ name: "id", value: { stringValue: String(evidenceFieldValue(row[0]) ?? "") } }],
  );
  return {
    workspaceId: String(evidenceFieldValue(row[1]) ?? ""),
    scope: String(evidenceFieldValue(row[2]) ?? "read_only"),
    expiresAt: String(evidenceFieldValue(row[3]) ?? ""),
    tenantId: String(evidenceFieldValue(row[4]) ?? ""),
    title: String(evidenceFieldValue(row[5]) ?? ""),
    geoid: String(evidenceFieldValue(row[6]) ?? ""),
    geographyName: String(evidenceFieldValue(row[7]) ?? ""),
  };
}

/**
 * Read-only share links expose the current named plan, not just a token
 * metadata record. The token is resolved once, then the same tenant-scoped
 * query used by authenticated participants loads the plan without granting
 * write access or returning the tenant identifier to the caller.
 */
export async function getSharedWorkspacePlan(input: { token: string }) {
  const share = await readWorkspaceShareLink(input);
  const plan = await loadPublicWorkspacePlan({
    workspaceId: share.workspaceId,
    tenantId: share.tenantId,
  });
  return {
    share: {
      scope: share.scope,
      expiresAt: share.expiresAt,
      title: share.title,
      geoid: share.geoid,
      geographyName: share.geographyName,
    },
    plan,
  };
}

export async function createWorkspaceHandoff(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
  targetRole: "county_planner" | "community_partner" | "research_funder_viewer" | "foundation_reviewer";
  targetPrincipalId?: string;
  expiresInHours?: number;
}) {
  if (input.actor.actorType !== "human") {
    throw new Error("Only an authorized human contributor may create a handoff.");
  }
  await requireWorkspaceMembership({ ...input, write: true });
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  const hours = Math.max(1, Math.min(72, Math.floor(input.expiresInHours ?? 24)));
  await executeEvidenceSql(
    `INSERT INTO evidence.workspace_handoff (
       id, workspace_id, tenant_id, source_principal_id, target_role,
       token_hash, status, target_principal_id, expires_at
     ) VALUES (
       CAST(:id AS uuid), CAST(:workspace_id AS uuid), CAST(:tenant_id AS uuid),
       :source_principal_id, :target_role, :token_hash, 'pending',
       :target_principal_id, now() + (:hours * interval '1 hour')
     )`,
    [
      { name: "id", value: { stringValue: id } },
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
      { name: "tenant_id", value: { stringValue: input.tenantId } },
      { name: "source_principal_id", value: { stringValue: input.actor.principalId } },
      { name: "target_role", value: { stringValue: input.targetRole } },
      { name: "token_hash", value: { stringValue: hashOpaqueToken(token) } },
      { name: "hours", value: { longValue: hours } },
      input.targetPrincipalId
        ? { name: "target_principal_id", value: { stringValue: input.targetPrincipalId } }
        : { name: "target_principal_id", value: { isNull: true } },
    ],
  );
  await executeEvidenceSql(
    `UPDATE evidence.county_workspace SET share_mode='handoff_ready', last_handoff_at=now()
     WHERE id=CAST(:workspace_id AS uuid) AND tenant_id=CAST(:tenant_id AS uuid)`,
    [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
      { name: "tenant_id", value: { stringValue: input.tenantId } },
    ],
  );
  await appendWorkspaceEvent({
    workspaceId: input.workspaceId,
    tenantId: input.tenantId,
    eventType: "workspace_handoff_created",
    actor: input.actor,
    idempotencyKey: `workspace-handoff-created:${id}`,
    evidenceSnapshotId: null,
    payload: { handoffId: id, targetRole: input.targetRole, expiresInHours: hours },
  });
  return { id, token, targetRole: input.targetRole, expiresInHours: hours };
}

export async function acceptWorkspaceHandoff(input: {
  token: string;
  tenantId: string;
  actor: WorkspaceActor;
  idempotencyKey: string;
}) {
  if (input.actor.actorType !== "human") throw new Error("Only an authenticated human may accept a handoff.");
  return executeEvidenceTransaction(async (transactionId) => {
    const result = await executeEvidenceSql(
      `SELECT id::text, workspace_id::text, target_role, target_principal_id
       FROM evidence.workspace_handoff
       WHERE token_hash=:token_hash AND tenant_id=CAST(:tenant_id AS uuid)
         AND status='pending' AND expires_at > now()
         AND (target_principal_id IS NULL OR target_principal_id=:principal_id)
       FOR UPDATE`,
      [
        { name: "token_hash", value: { stringValue: hashOpaqueToken(input.token) } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
        { name: "principal_id", value: { stringValue: input.actor.principalId } },
      ],
      transactionId,
    );
    const row = result.records?.[0];
    if (!row) throw new Error("This handoff is invalid, expired, or already accepted.");
    const handoffId = String(evidenceFieldValue(row[0]) ?? "");
    const workspaceId = String(evidenceFieldValue(row[1]) ?? "");
    const targetRole = String(evidenceFieldValue(row[2]) ?? "");
    const targetPrincipalId = evidenceFieldValue(row[3]);
    if (targetPrincipalId && String(targetPrincipalId) !== input.actor.principalId) {
      throw new Error("This handoff is bound to a different participant.");
    }
    const access = targetRole === "research_funder_viewer" ? "viewer" : "contributor";
    const authorizedActor: WorkspaceActor = {
      ...input.actor,
      role: targetRole as WorkspaceRole,
      access: access as WorkspaceAccess,
    };
    await executeEvidenceSql(
      `INSERT INTO evidence.workspace_participant (
         workspace_id, principal_id, role, access, display_name, joined_at
       ) VALUES (
         CAST(:workspace_id AS uuid), :principal_id, CAST(:role AS evidence.workspace_role),
         CAST(:access AS evidence.workspace_access), :display_name, now()
       ) ON CONFLICT (workspace_id, principal_id) DO UPDATE SET
         revoked_at=NULL, role=EXCLUDED.role, access=EXCLUDED.access,
         display_name=EXCLUDED.display_name`,
      [
        { name: "workspace_id", value: { stringValue: workspaceId } },
        { name: "principal_id", value: { stringValue: input.actor.principalId } },
        { name: "role", value: { stringValue: targetRole } },
        { name: "access", value: { stringValue: access } },
        { name: "display_name", value: { stringValue: input.actor.displayName } },
      ],
      transactionId,
    );
    await executeEvidenceSql(
      `UPDATE evidence.workspace_handoff
       SET status='accepted', accepted_by=:principal_id, accepted_at=now()
       WHERE id=CAST(:id AS uuid) AND status='pending'`,
      [
        { name: "id", value: { stringValue: handoffId } },
        { name: "principal_id", value: { stringValue: input.actor.principalId } },
      ],
      transactionId,
    );
    await appendTrustedMembershipEvent({
      workspaceId,
      tenantId: input.tenantId,
      eventType: "workspace_handoff_accepted",
      actor: authorizedActor,
      idempotencyKey: `workspace-handoff-accepted:${handoffId}`,
      evidenceSnapshotId: null,
      payload: { handoffId, role: targetRole, access },
      transactionId,
    });
    const event = await appendTrustedMembershipEvent({
      workspaceId,
      tenantId: input.tenantId,
      eventType: "participant_joined",
      actor: authorizedActor,
      idempotencyKey: input.idempotencyKey,
      evidenceSnapshotId: null,
      payload: { role: targetRole, access, handoff: true },
      transactionId,
    });
    return { workspaceId, role: targetRole, access, event };
  });
}

export async function forkCountyWorkspace(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
  title: string;
  idempotencyKey: string;
}) {
  if (input.actor.actorType !== "human") {
    throw new Error("Only an authorized human contributor may fork a workspace.");
  }
  const normalizedTitle = input.title.trim().slice(0, 240);
  const requestHash = sha256({ action: "fork_workspace", sourceWorkspaceId: input.workspaceId, title: normalizedTitle });
  return executeEvidenceTransaction(async (transactionId) => {
    await requireWorkspaceMembership({ ...input, write: true, transactionId });
    await executeEvidenceSql("SELECT pg_advisory_xact_lock(hashtext(:workspace_id))", [
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
    ], transactionId);
    const prior = await findWorkspaceMutationEvent({ ...input, transactionId });
    if (prior) {
      const priorHash = String(prior.payload.requestHash ?? "");
      const targetWorkspaceId = String(prior.payload.targetWorkspaceId ?? "");
      if (prior.eventType !== "workspace_forked" || priorHash !== requestHash || !targetWorkspaceId) {
        throw new Error("The idempotency key is already bound to a different workspace mutation.");
      }
      const fork = buildWorkspaceForkContract({
        sourceWorkspaceId: input.workspaceId,
        sourceVersion: Number(prior.payload.sourceVersion ?? 0),
        targetWorkspaceId,
        forkedBy: input.actor.principalId,
        forkedAt: String(prior.occurredAt),
        copiedSectionKeys: Array.isArray(prior.payload.copiedSectionKeys)
          ? prior.payload.copiedSectionKeys.map(String)
          : [],
        evidenceSnapshotId: String(prior.payload.evidenceSnapshotId ?? ""),
      });
      return { fork, event: prior };
    }
    const legacy = await findLegacyWorkspaceFork({ ...input, transactionId });
    if (legacy) {
      const expectedTitle = normalizedTitle || `Fork of ${legacy.sourceTitle}`;
      if (legacy.targetTitle !== expectedTitle || !legacy.targetWorkspaceId || !legacy.evidenceSnapshotId) {
        throw new Error("The idempotency key is already bound to a different workspace mutation.");
      }
      const copiedSectionKeys = Array.isArray(legacy.targetPayload.copiedSectionKeys)
        ? legacy.targetPayload.copiedSectionKeys.map(String)
        : Array.isArray(legacy.event.payload.copiedSectionKeys)
          ? legacy.event.payload.copiedSectionKeys.map(String)
          : [];
      const fork = buildWorkspaceForkContract({
        sourceWorkspaceId: input.workspaceId,
        sourceVersion: legacy.sourceVersion,
        targetWorkspaceId: legacy.targetWorkspaceId,
        forkedBy: input.actor.principalId,
        forkedAt: legacy.event.occurredAt,
        copiedSectionKeys,
        evidenceSnapshotId: legacy.evidenceSnapshotId,
      });
      return { fork, event: legacy.event };
    }
    const source = await executeEvidenceSql(
      `SELECT w.id::text, w.tenant_id::text, w.geography_id::text,
          w.evidence_snapshot_id::text, w.title, w.version, g.authority_id,
          p.role::text, p.access::text
       FROM evidence.county_workspace w
       JOIN evidence.geography g ON g.id=w.geography_id
       JOIN evidence.workspace_participant p ON p.workspace_id=w.id
       WHERE w.id=CAST(:workspace_id AS uuid) AND w.tenant_id=CAST(:tenant_id AS uuid)
          AND w.status='active' AND p.principal_id=:principal_id AND p.revoked_at IS NULL`,
      [
        { name: "workspace_id", value: { stringValue: input.workspaceId } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
        { name: "principal_id", value: { stringValue: input.actor.principalId } },
      ],
      transactionId,
    );
    const row = source.records?.[0];
    if (!row) throw new Error("The source workspace is unavailable.");
    const sourceVersion = Number(evidenceFieldValue(row[5]) ?? 0);
    const targetId = randomUUID();
    await executeEvidenceSql(
      `INSERT INTO evidence.county_workspace (
         id, tenant_id, geography_id, evidence_snapshot_id, title, status,
         version, policy_version, created_at, created_by, updated_at,
         parent_workspace_id, forked_from_version, share_mode
       ) VALUES (
         CAST(:id AS uuid), CAST(:tenant_id AS uuid), CAST(:geography_id AS uuid),
         CAST(:snapshot_id AS uuid), :title, 'active', 1, :policy_version,
         now(), :created_by, now(), CAST(:parent_id AS uuid), :source_version, 'private'
       )`,
      [
        { name: "id", value: { stringValue: targetId } },
        { name: "tenant_id", value: { stringValue: String(evidenceFieldValue(row[1]) ?? input.tenantId) } },
        { name: "geography_id", value: { stringValue: String(evidenceFieldValue(row[2]) ?? "") } },
        { name: "snapshot_id", value: { stringValue: String(evidenceFieldValue(row[3]) ?? "") } },
        { name: "title", value: { stringValue: normalizedTitle || `Fork of ${String(evidenceFieldValue(row[4]) ?? "workspace")}` } },
        { name: "policy_version", value: { stringValue: POLICY_VERSION } },
        { name: "created_by", value: { stringValue: input.actor.principalId } },
        { name: "parent_id", value: { stringValue: input.workspaceId } },
        { name: "source_version", value: { longValue: sourceVersion } },
      ],
      transactionId,
    );
    const sections = await executeEvidenceSql(
      `SELECT section_key, version, content::text
       FROM evidence.workspace_section WHERE workspace_id=CAST(:workspace_id AS uuid)`,
      [{ name: "workspace_id", value: { stringValue: input.workspaceId } }],
      transactionId,
    );
    const copiedSectionKeys: string[] = [];
    for (const section of sections.records ?? []) {
      const sectionKey = String(evidenceFieldValue(section[0]) ?? "");
      const content = String(evidenceFieldValue(section[2]) ?? "{}");
      copiedSectionKeys.push(sectionKey);
      await executeEvidenceSql(
        `INSERT INTO evidence.workspace_section (
           workspace_id, section_key, version, content, updated_by, updated_at
         ) VALUES (CAST(:workspace_id AS uuid), :section_key, :version, CAST(:content AS jsonb), :updated_by, now())`,
        [
          { name: "workspace_id", value: { stringValue: targetId } },
          { name: "section_key", value: { stringValue: sectionKey } },
          { name: "version", value: { longValue: Number(evidenceFieldValue(section[1]) ?? 1) } },
          { name: "content", value: { stringValue: content } },
          { name: "updated_by", value: { stringValue: input.actor.principalId } },
        ],
        transactionId,
      );
    }
    const fork = buildWorkspaceForkContract({
      sourceWorkspaceId: input.workspaceId,
      sourceVersion,
      targetWorkspaceId: targetId,
      forkedBy: input.actor.principalId,
      forkedAt: new Date().toISOString(),
      copiedSectionKeys,
      evidenceSnapshotId: String(evidenceFieldValue(row[3]) ?? ""),
    });
    const targetActor: WorkspaceActor = { ...input.actor, access: "owner" };
    await executeEvidenceSql(
      `INSERT INTO evidence.workspace_participant (
         workspace_id, principal_id, role, access, display_name, joined_at
       ) VALUES (CAST(:workspace_id AS uuid), :principal_id, CAST(:role AS evidence.workspace_role),
         CAST(:access AS evidence.workspace_access), :display_name, now())`,
      [
        { name: "workspace_id", value: { stringValue: targetId } },
        { name: "principal_id", value: { stringValue: input.actor.principalId } },
        { name: "role", value: { stringValue: String(evidenceFieldValue(row[7]) ?? input.actor.role) } },
        { name: "access", value: { stringValue: targetActor.access } },
        { name: "display_name", value: { stringValue: input.actor.displayName } },
      ],
      transactionId,
    );
    await executeEvidenceSql(
      `INSERT INTO evidence.workspace_participant (
         workspace_id, principal_id, role, access, display_name, joined_at
       ) VALUES (CAST(:workspace_id AS uuid), 'sozorock-place-agent', 'evidence_agent',
         'contributor', 'SozoRock Place Intelligence', now())`,
      [{ name: "workspace_id", value: { stringValue: targetId } }],
      transactionId,
    );
    const targetEvent = await appendWorkspaceEvent({
      workspaceId: targetId,
      tenantId: input.tenantId,
      eventType: "workspace_created",
      actor: targetActor,
      idempotencyKey: `fork-target:${sha256(`${input.workspaceId}:${input.idempotencyKey}`)}`,
      evidenceSnapshotId: fork.evidenceSnapshotId,
      payload: { forkedFrom: input.workspaceId, sourceVersion, copiedSectionKeys: fork.copiedSectionKeys },
      transactionId,
    });
    const event = await appendWorkspaceEvent({
      workspaceId: input.workspaceId,
      tenantId: input.tenantId,
      eventType: "workspace_forked",
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      evidenceSnapshotId: fork.evidenceSnapshotId,
      requestHash,
      payload: {
        targetWorkspaceId: targetId,
        targetEventId: targetEvent.id,
        sourceVersion,
        copiedSectionKeys: fork.copiedSectionKeys,
        evidenceSnapshotId: fork.evidenceSnapshotId,
        requestHash,
      },
      transactionId,
    });
    return { fork, event };
  });
}

export async function recordExploreUsage(
  input: Omit<EvidenceUsageEvent, "retentionUntil" | "countsAsTraction"> & { retentionDays?: number },
) {
  await requireEvidenceCapability("explore:usage-instrumentation");
  const event = buildUsageEvent(input);
  const geographyId = event.geographyId;
  await executeEvidenceSql(
    `INSERT INTO evidence.explore_usage_event (
       id, event_name, geography_id, workspace_id, session_id_hash,
       environment, metadata, occurred_at, retention_until, counts_as_traction
     ) VALUES (
       CAST(:id AS uuid), :event_name,
       NULLIF(:geography_id, '')::uuid, NULLIF(:workspace_id, '')::uuid,
       NULLIF(:session_hash, ''), :environment, CAST(:metadata AS jsonb),
       CAST(:occurred_at AS timestamptz), CAST(:retention_until AS timestamptz), :traction
     )`,
    [
      { name: "id", value: { stringValue: randomUUID() } },
      { name: "event_name", value: { stringValue: event.eventName } },
      { name: "geography_id", value: { stringValue: geographyId ?? "" } },
      { name: "workspace_id", value: { stringValue: event.workspaceId ?? "" } },
      { name: "session_hash", value: { stringValue: event.sessionIdHash ?? "" } },
      { name: "environment", value: { stringValue: event.environment } },
      { name: "metadata", value: { stringValue: JSON.stringify(event.metadata) } },
      { name: "occurred_at", value: { stringValue: event.occurredAt } },
      { name: "retention_until", value: { stringValue: event.retentionUntil } },
      { name: "traction", value: { booleanValue: event.countsAsTraction } },
    ],
  );
  return event;
}

export async function recordExplorePerformance(input: PerformanceSample) {
  await requireEvidenceCapability("explore:usage-instrumentation");
  const sample = buildPerformanceSample(input);
  await executeEvidenceSql(
    `INSERT INTO evidence.explore_performance_sample (
       id, operation, environment, latency_ms, success, error_class,
       estimated_cost_micros, input_tokens, output_tokens, correction_required, occurred_at
     ) VALUES (
       CAST(:id AS uuid), :operation, :environment, :latency_ms, :success, :error_class,
       :cost, :input_tokens, :output_tokens, :correction_required, CAST(:occurred_at AS timestamptz)
     )`,
    [
      { name: "id", value: { stringValue: randomUUID() } },
      { name: "operation", value: { stringValue: sample.operation } },
      { name: "environment", value: { stringValue: sample.environment } },
      { name: "latency_ms", value: { longValue: sample.latencyMs } },
      { name: "success", value: { booleanValue: sample.success } },
      { name: "error_class", value: { stringValue: sample.errorClass ?? "" } },
      { name: "cost", value: sample.estimatedCostMicros === null ? { isNull: true } : { longValue: sample.estimatedCostMicros } },
      { name: "input_tokens", value: sample.inputTokens === null ? { isNull: true } : { longValue: sample.inputTokens } },
      { name: "output_tokens", value: sample.outputTokens === null ? { isNull: true } : { longValue: sample.outputTokens } },
      { name: "correction_required", value: { booleanValue: sample.correctionRequired } },
      { name: "occurred_at", value: { stringValue: sample.occurredAt } },
    ],
  );
  return sample;
}

export async function createPilotOnboardingRequest(input: {
  countyGeoid: string;
  organization: string;
  contactName: string;
  email: string;
  role: "county" | "provider" | "library" | "community_host" | "education_workforce" | "funder" | "research";
  intendedUse: string;
  consent: boolean;
  source: "explore" | "funder_snapshot" | "partner_referral" | "direct";
  environment: "staging" | "production" | "test";
}) {
  await requireEvidenceCapability("explore:pilot-onboarding");
  const decision = evaluatePilotOnboarding(input);
  if (!decision.accepted) {
    const error = new Error(decision.reasons.join(" "));
    error.name = "PilotOnboardingValidationError";
    throw error;
  }
  const idempotencyKey = hashOpaqueToken(JSON.stringify({
    countyGeoid: input.countyGeoid,
    email: input.email.trim().toLowerCase(),
    organization: input.organization.trim().toLowerCase(),
    source: input.source,
  }));
  const retentionUntil = new Date(Date.now() + decision.retentionDays * 86_400_000).toISOString();
  const id = randomUUID();
  const result = await executeEvidenceSql(
    `INSERT INTO evidence.explore_onboarding_request (
       id, county_geoid, organization, contact_name, email, role, intended_use,
       consent, source, environment, status, idempotency_key, retention_until
     ) VALUES (
       CAST(:id AS uuid), :county_geoid, :organization, :contact_name, :email,
       :role, :intended_use, :consent, :source, :environment,
       'ready_for_review', :idempotency_key, CAST(:retention_until AS timestamptz)
     ) ON CONFLICT (idempotency_key) DO UPDATE SET id=id
     RETURNING id::text, status, retention_until::text`,
    [
      { name: "id", value: { stringValue: id } },
      { name: "county_geoid", value: { stringValue: input.countyGeoid } },
      { name: "organization", value: { stringValue: input.organization.trim().slice(0, 180) } },
      { name: "contact_name", value: { stringValue: input.contactName.trim().slice(0, 120) } },
      { name: "email", value: { stringValue: input.email.trim().toLowerCase() } },
      { name: "role", value: { stringValue: input.role } },
      { name: "intended_use", value: { stringValue: input.intendedUse.trim().slice(0, 1000) } },
      { name: "consent", value: { booleanValue: input.consent } },
      { name: "source", value: { stringValue: input.source } },
      { name: "environment", value: { stringValue: input.environment } },
      { name: "idempotency_key", value: { stringValue: idempotencyKey } },
      { name: "retention_until", value: { stringValue: retentionUntil } },
    ],
  );
  const row = result.records?.[0];
  return {
    id: String(evidenceFieldValue(row?.[0]) ?? id),
    status: String(evidenceFieldValue(row?.[1]) ?? "ready_for_review"),
    retentionUntil: String(evidenceFieldValue(row?.[2]) ?? retentionUntil),
    disclosure: decision.prohibitedDataNotice,
  };
}

export const workspaceRuntimeVersions = {
  policyVersion: POLICY_VERSION,
  requestHash: sha256,
};
