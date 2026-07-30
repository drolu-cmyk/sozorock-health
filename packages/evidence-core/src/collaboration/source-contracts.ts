import { createHash } from "node:crypto";
import type { SourceAdapterContract, SourceCandidateAssessment } from "./types.ts";

function fingerprint(value: unknown) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

const contracts = [
  {
    sourceId: "census-geography",
    contractVersion: "census-geography.2025.v1",
    officialHostAllowlist: ["www2.census.gov", "tigerweb.geo.census.gov", "api.census.gov"],
    schema: ["GEOID", "NAME", "LSAD", "ALAND", "AWATER", "INTPTLAT", "INTPTLONG"],
    releaseDiscovery: { method: "versioned_download", vintage: "2025" },
    retrievalSchedule: "0 3 15 1 *",
    freshnessPolicy: { maximumAgeDays: 450 },
    measureMappingVersion: "census-geography.mapping.v1",
  },
  {
    sourceId: "cdc-places",
    contractVersion: "cdc-places.2025.v1",
    officialHostAllowlist: ["data.cdc.gov", "www.cdc.gov"],
    schema: [
      "locationid", "measureid", "measure", "data_value", "low_confidence_limit",
      "high_confidence_limit", "year", "datavaluetypeid",
    ],
    releaseDiscovery: { method: "socrata_metadata" },
    retrievalSchedule: "0 4 1 * *",
    freshnessPolicy: { maximumAgeDays: 400 },
    measureMappingVersion: "cdc-places.directionality.v2",
  },
  {
    sourceId: "census-acs5",
    contractVersion: "acs5.2024.v1",
    officialHostAllowlist: ["api.census.gov", "www2.census.gov"],
    schema: ["NAME", "state", "county", "estimate", "margin_of_error", "universe"],
    releaseDiscovery: { method: "census_data_api", vintage: "2024", dataset: "acs/acs5" },
    retrievalSchedule: "0 5 15 * *",
    freshnessPolicy: { maximumAgeDays: 450 },
    measureMappingVersion: "acs5.context.v1",
  },
  {
    sourceId: "hrsa-workforce",
    contractVersion: "hrsa-workforce.v1",
    officialHostAllowlist: ["data.hrsa.gov", "datawarehouse.hrsa.gov"],
    schema: [
      "designation_id", "designation_type", "discipline", "status",
      "effective_date", "geography", "whole_county",
    ],
    releaseDiscovery: { method: "official_versioned_download" },
    retrievalSchedule: "0 5 1 * *",
    freshnessPolicy: { maximumAgeDays: 120 },
    measureMappingVersion: "hrsa-designation-scope.v2",
  },
  {
    sourceId: "ahrf-workforce",
    contractVersion: "ahrf-workforce.v1",
    officialHostAllowlist: ["data.hrsa.gov", "datawarehouse.hrsa.gov"],
    schema: ["county_fips", "variable_id", "value", "year", "unit"],
    releaseDiscovery: { method: "official_versioned_download" },
    retrievalSchedule: "0 6 15 1,7 *",
    freshnessPolicy: { maximumAgeDays: 550 },
    measureMappingVersion: "ahrf-approved-variables.v1",
  },
  {
    sourceId: "ahrq-clh",
    contractVersion: "ahrq-clh.2025.v1",
    officialHostAllowlist: ["www.ahrq.gov"],
    schema: ["county_fips", "variable_id", "value", "data_period", "codebook_definition"],
    releaseDiscovery: { method: "official_workbook_and_codebook" },
    retrievalSchedule: "0 6 1 * *",
    freshnessPolicy: { maximumAgeDays: 450 },
    measureMappingVersion: "ahrq-clh-approved-variables.v1",
  },
  {
    sourceId: "local-planning-documents",
    contractVersion: "local-plans.official-directory.v1",
    officialHostAllowlist: [".gov", ".us"],
    schema: [
      "publisher", "covered_geography", "document_type", "publication_date",
      "plan_cycle", "official_url", "review_status",
    ],
    releaseDiscovery: { method: "approved_official_source_directory" },
    retrievalSchedule: "0 7 1 * *",
    freshnessPolicy: { maximumAgeDays: 45 },
    measureMappingVersion: "local-plan-human-review.v1",
  },
] as const;

export const SOURCE_ADAPTER_CONTRACTS: readonly SourceAdapterContract[] = contracts.map((contract) => ({
  sourceId: contract.sourceId,
  contractVersion: contract.contractVersion,
  officialHostAllowlist: [...contract.officialHostAllowlist],
  schemaFingerprint: fingerprint(contract.schema),
  releaseDiscovery: contract.releaseDiscovery,
  retrievalSchedule: contract.retrievalSchedule,
  freshnessPolicy: contract.freshnessPolicy,
  measureMappingVersion: contract.measureMappingVersion,
  status: "active",
  lastApprovedSnapshotId: null,
  rollbackSnapshotId: null,
}));

export function buildAdapterReviewProposal(
  assessment: SourceCandidateAssessment,
) {
  return {
    title: `[Evidence adapter review] ${assessment.sourceId} ${assessment.status.replaceAll("_", " ")}`,
    labels: ["evidence-source", "human-review-required"],
    body: [
      `Source: ${assessment.sourceId}`,
      `Contract: ${assessment.contractVersion}`,
      `Status: ${assessment.status}`,
      "",
      ...assessment.findings.map((finding) => `- ${finding}`),
      "",
      "Production mappings and snapshots remain unchanged until an authorized reviewer approves this proposal.",
    ].join("\n"),
    publishable: false as const,
  };
}
