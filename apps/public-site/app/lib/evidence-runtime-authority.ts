import { createHash, randomUUID } from "node:crypto";
import {
  BeginTransactionCommand,
  CommitTransactionCommand,
  ExecuteStatementCommand,
  RDSDataClient,
  RollbackTransactionCommand,
  type Field,
  type SqlParameter,
} from "@aws-sdk/client-rds-data";

const client = new RDSDataClient({ region: process.env.AWS_REGION ?? "us-east-1" });

export type EvidenceAuthorityFailureCode =
  | "authority_configuration"
  | "authority_access"
  | "authority_database"
  | "authority_state"
  | "authority_unavailable";

export function evidenceAuthorityFailureCode(error: unknown): EvidenceAuthorityFailureCode {
  const item = error && typeof error === "object" ? error as { name?: unknown; message?: unknown } : {};
  const name = typeof item.name === "string" ? item.name : "";
  const message = typeof item.message === "string" ? item.message : "";
  if (message === "Evidence runtime authority is not configured.") return "authority_configuration";
  if (/AccessDenied|Forbidden|UnrecognizedClient|CredentialsProvider/i.test(name)) return "authority_access";
  if (/DatabaseError|BadRequest|StatementTimeout|ServiceUnavailable/i.test(name)) return "authority_database";
  if (/not approved by the production authority|missing from the production evidence store/i.test(message)) {
    return "authority_state";
  }
  return "authority_unavailable";
}

export type EvidenceRuntimeEnvironment = "production" | "staging" | "test";

/**
 * Environment is deployment authority, never request data.  Production and
 * staging workflows set the rate-limit namespace even when Amplify does not
 * expose a separate runtime flag; an unset local process is deliberately
 * treated as test so it cannot create production traction records.
 */
export function evidenceRuntimeEnvironment(): EvidenceRuntimeEnvironment {
  const configured = (process.env.RUNTIME_ENV ?? process.env.PLACE_AGENT_RATE_LIMIT_NAMESPACE ?? "").trim().toLowerCase();
  if (configured === "production") return "production";
  if (configured === "staging") return "staging";
  return "test";
}

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

export function evidenceFieldValue(field: Field | undefined) {
  if (!field || field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  return null;
}

export async function executeEvidenceSql(
  sql: string,
  parameters: SqlParameter[] = [],
  transactionId?: string,
) {
  const authority = config();
  return client.send(new ExecuteStatementCommand({
    resourceArn: authority.clusterArn,
    secretArn: authority.secretArn,
    database: authority.database,
    sql,
    parameters,
    transactionId,
    includeResultMetadata: true,
  }));
}

export async function executeEvidenceTransaction<T>(
  work: (transactionId: string) => Promise<T>,
) {
  const authority = config();
  const opened = await client.send(new BeginTransactionCommand({
    resourceArn: authority.clusterArn,
    secretArn: authority.secretArn,
    database: authority.database,
  }));
  if (!opened.transactionId) throw new Error("Evidence transaction could not be opened.");
  try {
    const result = await work(opened.transactionId);
    await client.send(new CommitTransactionCommand({
      resourceArn: authority.clusterArn,
      secretArn: authority.secretArn,
      transactionId: opened.transactionId,
    }));
    return result;
  } catch (error) {
    await client.send(new RollbackTransactionCommand({
      resourceArn: authority.clusterArn,
      secretArn: authority.secretArn,
      transactionId: opened.transactionId,
    }));
    throw error;
  }
}

export type EvidenceAuthority = {
  snapshotUuid: string;
  snapshotContentHash: string;
  narrativeEnabled: boolean;
  openAiEnabled: boolean;
};

export function assertSnapshotContentHash(snapshotContentHash: string) {
  const normalized = snapshotContentHash.trim();
  if (!/^sha256:[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("The configured evidence snapshot content hash is invalid.");
  }
  return normalized;
}

/** Verify that the immutable snapshot shipped to the route is the snapshot
 * currently approved by the Evidence Core.  This intentionally does not read
 * narrative or agent capability switches; deterministic Brief/Map/Visuals
 * delivery must remain available when the agent is disabled. */
export async function requirePublishedEvidenceSnapshot(snapshotContentHash: string) {
  const validatedHash = assertSnapshotContentHash(snapshotContentHash);
  const result = await executeEvidenceSql(
    `SELECT s.id::text, s.content_hash
       FROM evidence.evidence_snapshot s
      WHERE s.content_hash=:content_hash
        AND s.review_status='verified'
        AND s.published_at IS NOT NULL`,
    [{ name: "content_hash", value: { stringValue: validatedHash } }],
  );
  const row = result.records?.[0];
  const snapshotUuid = String(evidenceFieldValue(row?.[0]) ?? "");
  const contentHash = String(evidenceFieldValue(row?.[1]) ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(snapshotUuid) || contentHash !== validatedHash) {
    throw new Error("The bundled evidence snapshot is not approved by the production authority.");
  }
  return { snapshotUuid, snapshotContentHash: contentHash };
}

export async function requireEvidenceAuthority(
  snapshotContentHash: string,
): Promise<EvidenceAuthority> {
  const validatedHash = assertSnapshotContentHash(snapshotContentHash);
  const result = await executeEvidenceSql(
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
       AND s.published_at IS NOT NULL`,
    [{
      name: "content_hash",
      value: { stringValue: validatedHash },
    }],
  );
  const row = result.records?.[0];
  if (!row) throw new Error("The bundled evidence snapshot is not approved by the production authority.");
  const snapshotUuid = String(evidenceFieldValue(row[0]) ?? "");
  const contentHash = String(evidenceFieldValue(row[1]) ?? "");
  const narrativeEnabled = evidenceFieldValue(row[2]) === true;
  const openAiEnabled = evidenceFieldValue(row[3]) === true;
  if (!snapshotUuid || contentHash !== validatedHash) {
    throw new Error("Evidence snapshot authority mismatch.");
  }
  return {
    snapshotUuid,
    snapshotContentHash: contentHash,
    narrativeEnabled,
    openAiEnabled,
  };
}

export async function requireEvidenceCapability(capabilityKey: string) {
  const result = await executeEvidenceSql(
    `SELECT enabled, reason FROM evidence.capability_switch WHERE capability_key=:capability_key`,
    [{ name: "capability_key", value: { stringValue: capabilityKey } }],
  );
  const row = result.records?.[0];
  if (!row || evidenceFieldValue(row[0]) !== true) {
    throw new Error(String(evidenceFieldValue(row?.[1]) ?? "Evidence capability is not enabled."));
  }
}

export async function evidenceCapabilityEnabled(capabilityKey: string) {
  const result = await executeEvidenceSql(
    `SELECT enabled FROM evidence.capability_switch WHERE capability_key=:capability_key`,
    [{ name: "capability_key", value: { stringValue: capabilityKey } }],
  );
  return evidenceFieldValue(result.records?.[0]?.[0]) === true;
}

/**
 * Resolve the persisted canonical geography identifier used by the Evidence
 * Core.  Public routes receive a Census GEOID, but audit records must point
 * at the immutable `evidence.geography` row rather than storing a second,
 * free-form geography identifier.
 */
export async function requireEvidenceGeographyId(countyGeoid: string, snapshotContentHash?: string) {
  if (!/^\d{5}$/.test(countyGeoid)) throw new Error("County GEOID is invalid.");
  const pinnedHash = snapshotContentHash ? assertSnapshotContentHash(snapshotContentHash) : null;
  const query = pinnedHash
    ? `SELECT g.id::text
         FROM evidence.geography g
         JOIN evidence.evidence_snapshot s
           ON s.content_hash=:snapshot_hash
          AND s.review_status='verified'
          AND s.published_at IS NOT NULL
         JOIN evidence.snapshot_source_version link ON link.snapshot_id=s.id
         JOIN evidence.source_version census_source
           ON census_source.id=link.source_version_id
          AND census_source.source_id='census-geography'
        WHERE g.authority='census'
          AND g.authority_id=:county_geoid
          AND g.kind='county'
          AND g.review_status='verified'
          AND g.vintage=to_char(census_source.release_date, 'YYYY')
        ORDER BY g.vintage DESC
        LIMIT 1`
    : `SELECT id::text
         FROM evidence.geography
        WHERE authority='census'
          AND authority_id=:county_geoid
          AND kind='county'
          AND review_status='verified'
        ORDER BY vintage DESC
        LIMIT 1`;
  const result = await executeEvidenceSql(
    query,
    [
      { name: "county_geoid", value: { stringValue: countyGeoid } },
      ...(pinnedHash ? [{ name: "snapshot_hash", value: { stringValue: pinnedHash } }] : []),
    ],
  );
  const id = String(evidenceFieldValue(result.records?.[0]?.[0]) ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("The canonical county is missing from the production evidence store.");
  }
  return id;
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
  await executeEvidenceSql(
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
