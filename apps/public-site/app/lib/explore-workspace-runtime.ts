import { randomBytes, randomUUID } from "node:crypto";
import type {
  ScenarioInputs,
  WorkspaceAccess,
  WorkspaceActor,
  WorkspaceEventType,
  WorkspaceRole,
} from "@sozorock/evidence-core";
import { buildPlanningScenario } from "@sozorock/evidence-core";
import {
  evidenceFieldValue,
  executeEvidenceSql,
  executeEvidenceTransaction,
  requireEvidenceCapability,
  sha256,
} from "./evidence-runtime-authority";

const POLICY_VERSION = "place-intelligence.collaboration.v1";

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
  transactionId?: string;
}) {
  const result = await executeEvidenceSql(
    `SELECT p.access::text
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
  if (!access || (input.write && access === "viewer")) {
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
       WHERE content_hash=:hash AND review_status='verified' AND published_at IS NOT NULL
       ORDER BY published_at DESC LIMIT 1`,
      [{ name: "hash", value: { stringValue: input.snapshotContentHash } }],
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
       ON CONFLICT (tenant_id, geography_id) WHERE status = 'active'
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

export async function appendWorkspaceEvent(input: {
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
}) {
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
    if (!access || (access === "viewer" && input.eventType !== "participant_joined")) {
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
  return executeEvidenceTransaction(async (transactionId) => {
    await requireWorkspaceMembership({
      workspaceId: input.workspaceId,
      tenantId: input.tenantId,
      actor: input.actor,
      write: true,
      transactionId,
    });
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
      },
      transactionId,
    });
    return { id: scenarioId, versionId, output, event };
  });
}

export async function getWorkspacePlan(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
}) {
  await requireWorkspaceMembership(input);
  const [workspace, sections, comments, questions, suggestions, scenarios] = await Promise.all([
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
  };
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
      payload: { sectionKey: input.sectionKey, fromVersion: currentVersion, toVersion: currentVersion + 1 },
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
    return { sectionKey: input.sectionKey, version: nextVersion, content: input.content, event };
  });
}

export async function createWorkspaceInvitation(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
  role: Exclude<WorkspaceRole, "evidence_agent">;
  access: Exclude<WorkspaceAccess, "owner">;
}) {
  if (input.actor.actorType !== "human" || input.actor.access !== "owner") {
    throw new Error("Only a human workspace owner may create an invitation.");
  }
  await requireWorkspaceMembership({ ...input, write: true });
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  await executeEvidenceSql(
    `INSERT INTO evidence.workspace_invitation (
       id, workspace_id, token_hash, role, access, invited_by, expires_at, created_at
     ) VALUES (
       CAST(:id AS uuid), CAST(:workspace_id AS uuid), :token_hash,
       CAST(:role AS evidence.workspace_role), CAST(:access AS evidence.workspace_access),
       :invited_by, now() + interval '7 days', now()
     )`,
    [
      { name: "id", value: { stringValue: id } },
      { name: "workspace_id", value: { stringValue: input.workspaceId } },
      { name: "token_hash", value: { stringValue: sha256(token) } },
      { name: "role", value: { stringValue: input.role } },
      { name: "access", value: { stringValue: input.access } },
      { name: "invited_by", value: { stringValue: input.actor.principalId } },
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
      `SELECT i.id::text, i.workspace_id::text, i.role::text, i.access::text
       FROM evidence.workspace_invitation i
       JOIN evidence.county_workspace w ON w.id=i.workspace_id
       WHERE i.token_hash=:token_hash
         AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
         AND w.tenant_id=CAST(:tenant_id AS uuid) AND w.status='active'
       FOR UPDATE`,
      [
        { name: "token_hash", value: { stringValue: sha256(input.token) } },
        { name: "tenant_id", value: { stringValue: input.tenantId } },
      ],
      transactionId,
    );
    const row = invitation.records?.[0];
    if (!row) throw new Error("This workspace invitation is invalid, expired, or outside your organization.");
    const invitationId = String(evidenceFieldValue(row[0]) ?? "");
    const workspaceId = String(evidenceFieldValue(row[1]) ?? "");
    const role = String(evidenceFieldValue(row[2]) ?? "");
    const access = String(evidenceFieldValue(row[3]) ?? "");
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
    const event = await appendWorkspaceEvent({
      workspaceId,
      tenantId: input.tenantId,
      eventType: "participant_joined",
      actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      evidenceSnapshotId: null,
      payload: { role, access },
      transactionId,
    });
    return { workspaceId, role, access, event };
  });
}

export const workspaceRuntimeVersions = {
  policyVersion: POLICY_VERSION,
  requestHash: sha256,
};
