import { createHash, randomUUID } from "node:crypto";
import {
  ExecuteStatementCommand,
  RDSDataClient,
  type Field,
} from "@aws-sdk/client-rds-data";

const client = new RDSDataClient({});

type AuthorityConfig = {
  clusterArn: string;
  secretArn: string;
  database: string;
};

function config(): AuthorityConfig {
  const clusterArn = process.env.EVIDENCE_DATABASE_CLUSTER_ARN?.trim();
  const secretArn = process.env.EVIDENCE_DATABASE_SECRET_ARN?.trim();
  const database = process.env.EVIDENCE_DATABASE_NAME?.trim() || "sozorock_evidence";
  if (!clusterArn || !secretArn) {
    throw new Error("Evidence runtime authority is not configured.");
  }
  return { clusterArn, secretArn, database };
}

function fieldValue(field: Field | undefined) {
  if (!field || field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  return null;
}

async function execute(sql: string, parameters: Array<{
  name: string;
  value: Field;
}> = []) {
  const authority = config();
  return client.send(new ExecuteStatementCommand({
    resourceArn: authority.clusterArn,
    secretArn: authority.secretArn,
    database: authority.database,
    sql,
    parameters,
    includeResultMetadata: true,
  }));
}

export type EvidenceAuthority = {
  snapshotUuid: string;
  snapshotContentHash: string;
  narrativeEnabled: boolean;
  openAiEnabled: boolean;
};

export async function requireEvidenceAuthority(
  snapshotContentHash: string,
): Promise<EvidenceAuthority> {
  const result = await execute(
    `SELECT
       s.id::text,
       s.content_hash,
       COALESCE(n.enabled, false),
       COALESCE(o.enabled, false)
     FROM evidence.evidence_snapshot s
     LEFT JOIN evidence.capability_switch n ON n.capability_key='narrative_generation'
     LEFT JOIN evidence.capability_switch o ON o.capability_key='provider:openai_responses'
     WHERE s.content_hash=:content_hash
       AND s.review_status='verified'
       AND s.published_at IS NOT NULL
     ORDER BY s.published_at DESC
     LIMIT 1`,
    [{
      name: "content_hash",
      value: { stringValue: snapshotContentHash },
    }],
  );
  const row = result.records?.[0];
  if (!row) throw new Error("The bundled evidence snapshot is not approved by the production authority.");
  const snapshotUuid = String(fieldValue(row[0]) ?? "");
  const contentHash = String(fieldValue(row[1]) ?? "");
  const narrativeEnabled = fieldValue(row[2]) === true;
  const openAiEnabled = fieldValue(row[3]) === true;
  if (!snapshotUuid || contentHash !== snapshotContentHash) {
    throw new Error("Evidence snapshot authority mismatch.");
  }
  return {
    snapshotUuid,
    snapshotContentHash: contentHash,
    narrativeEnabled,
    openAiEnabled,
  };
}

export function sha256(value: unknown) {
  const content = typeof value === "string" ? value : JSON.stringify(value);
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export async function writeExecutionAudit(input: {
  executionType: "internal_agent" | "partner_brief" | "comparison";
  contractVersion: string;
  policyVersion: string;
  snapshotUuid: string;
  geographyUuid: string | null;
  requestHash: string;
  responseHash: string | null;
  outcome: "succeeded" | "rejected" | "failed";
  reason: string;
  metadata: Record<string, unknown>;
}) {
  await execute(
    `INSERT INTO evidence.execution_audit (
       id, execution_type, contract_version, policy_version, snapshot_id,
       geography_id, request_hash, response_hash, outcome, reason, occurred_at, metadata
     ) VALUES (
       CAST(:id AS uuid), :execution_type, :contract_version, :policy_version,
       CAST(:snapshot_id AS uuid), CAST(:geography_id AS uuid), :request_hash,
       :response_hash, :outcome, :reason, now(), CAST(:metadata AS jsonb)
     )`,
    [
      { name: "id", value: { stringValue: randomUUID() } },
      { name: "execution_type", value: { stringValue: input.executionType } },
      { name: "contract_version", value: { stringValue: input.contractVersion } },
      { name: "policy_version", value: { stringValue: input.policyVersion } },
      { name: "snapshot_id", value: { stringValue: input.snapshotUuid } },
      input.geographyUuid
        ? { name: "geography_id", value: { stringValue: input.geographyUuid } }
        : { name: "geography_id", value: { isNull: true } },
      { name: "request_hash", value: { stringValue: input.requestHash } },
      input.responseHash
        ? { name: "response_hash", value: { stringValue: input.responseHash } }
        : { name: "response_hash", value: { isNull: true } },
      { name: "outcome", value: { stringValue: input.outcome } },
      { name: "reason", value: { stringValue: input.reason.slice(0, 1_000) } },
      { name: "metadata", value: { stringValue: JSON.stringify(input.metadata) } },
    ],
  );
}
