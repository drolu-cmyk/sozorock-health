import {
  ExecuteStatementCommand,
  RDSDataClient,
} from "@aws-sdk/client-rds-data";
import { SOURCE_ADAPTER_CONTRACTS } from "../src/collaboration/source-contracts.ts";

const resourceArn = process.env.EVIDENCE_DATABASE_CLUSTER_ARN?.trim();
const secretArn = process.env.EVIDENCE_DATABASE_SECRET_ARN?.trim();
const database = process.env.EVIDENCE_DATABASE_NAME?.trim();
const expectedArn = process.env.EVIDENCE_EXPECTED_CLUSTER_ARN?.trim();
const approvedBy = process.env.EVIDENCE_CONTROL_PLANE_APPROVED_BY?.trim();
if (!resourceArn || !secretArn || !database || resourceArn !== expectedArn) {
  throw new Error("The approved Evidence Data API target is unresolved.");
}
if (process.env.EVIDENCE_CONTROL_PLANE_SEED_APPROVED !== "true" || !approvedBy) {
  throw new Error("Named approval is required to seed source-adapter contracts.");
}

const client = new RDSDataClient({});
const response = await client.send(new ExecuteStatementCommand({
  resourceArn,
  secretArn,
  database,
  sql: `
    INSERT INTO evidence.source_adapter_contract (
      source_id, contract_version, official_host_allowlist, schema_fingerprint,
      release_discovery, retrieval_schedule, freshness_policy,
      measure_mapping_version, status, last_approved_snapshot_id,
      rollback_snapshot_id, approved_by, approved_at
    )
    SELECT
      x.source_id, x.contract_version,
      ARRAY(SELECT jsonb_array_elements_text(x.official_host_allowlist))::text[],
      x.schema_fingerprint, x.release_discovery, x.retrieval_schedule,
      x.freshness_policy, x.measure_mapping_version, 'active',
      NULL, NULL, :approved_by, now()
    FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
      source_id text, contract_version text, official_host_allowlist jsonb,
      schema_fingerprint text, release_discovery jsonb, retrieval_schedule text,
      freshness_policy jsonb, measure_mapping_version text
    )
    ON CONFLICT (source_id, contract_version) DO NOTHING
  `,
  parameters: [
    {
      name: "payload",
      value: {
        stringValue: JSON.stringify(SOURCE_ADAPTER_CONTRACTS.map((contract) => ({
          source_id: contract.sourceId,
          contract_version: contract.contractVersion,
          official_host_allowlist: contract.officialHostAllowlist,
          schema_fingerprint: contract.schemaFingerprint,
          release_discovery: contract.releaseDiscovery,
          retrieval_schedule: contract.retrievalSchedule,
          freshness_policy: contract.freshnessPolicy,
          measure_mapping_version: contract.measureMappingVersion,
        }))),
      },
    },
    { name: "approved_by", value: { stringValue: approvedBy.slice(0, 200) } },
  ],
}));

console.log(JSON.stringify({
  contractVersion: "explore.source-control.seed.v1",
  contractsRequested: SOURCE_ADAPTER_CONTRACTS.length,
  recordsChanged: response.numberOfRecordsUpdated ?? 0,
  approvedBy,
}));
