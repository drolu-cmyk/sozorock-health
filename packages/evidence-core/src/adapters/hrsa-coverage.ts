import type { Geography } from "../contracts.ts";
import type { GatewaySourceCoverageAssertion } from "../evidence-gateway.ts";
import type { AdapterBatch } from "../ingestion/types.ts";

export const HPSA_COVERAGE_KEYS = [
  "hpsa:primary_care",
  "hpsa:dental",
  "hpsa:mental_health",
] as const;

export type HpsaCoverageKey = (typeof HPSA_COVERAGE_KEYS)[number];

export type HpsaCoverageBatch = {
  coverageKey: HpsaCoverageKey;
  batch: AdapterBatch;
};

export type BuildHpsaCoverageInput = {
  geography: Geography;
  evaluatedAt: string;
  batches: HpsaCoverageBatch[];
};

function coverageStatus(batch: AdapterBatch): GatewaySourceCoverageAssertion["status"] {
  if (batch.status === "stale") return "stale";
  if (batch.status === "unavailable") return "unavailable";
  if (batch.recordsRejected > 0 || batch.recordsAccepted !== batch.observations.length) {
    return "partial";
  }
  return batch.observations.length > 0
    ? "complete_with_records"
    : "complete_no_records";
}

export function buildHrsaHpsaCoverageAssertions({
  geography,
  evaluatedAt,
  batches,
}: BuildHpsaCoverageInput): GatewaySourceCoverageAssertion[] {
  if (geography.kind !== "county" || !/^\d{5}$/.test(geography.authorityId)) {
    throw new Error("HPSA coverage assertions require a county geography with five-digit FIPS.");
  }
  if (!Number.isFinite(Date.parse(evaluatedAt))) {
    throw new Error("HPSA coverage assertions require an ISO-compatible evaluatedAt timestamp.");
  }

  const seen = new Set<HpsaCoverageKey>();
  const assertions: GatewaySourceCoverageAssertion[] = [];

  for (const entry of batches) {
    if (seen.has(entry.coverageKey)) {
      throw new Error(`Duplicate HPSA coverage product ${entry.coverageKey}.`);
    }
    seen.add(entry.coverageKey);

    const { batch } = entry;
    if (batch.adapterId !== "hrsa-hpsa-v2" || batch.sourceId !== "hrsa-workforce") {
      throw new Error(`Coverage product ${entry.coverageKey} is not an HRSA HPSA adapter batch.`);
    }
    if (!batch.sourceVersion) {
      throw new Error(`Coverage product ${entry.coverageKey} has no source version and cannot prove source coverage.`);
    }
    if (batch.observations.some((item) => item.geographyId !== geography.id)) {
      throw new Error(`Coverage product ${entry.coverageKey} contains observations for another geography.`);
    }

    const status = coverageStatus(batch);
    const recordsMatched = batch.observations.length;
    const caveats: string[] = [];
    if (status === "partial") {
      caveats.push("One or more county-matched records were rejected or the adapter counts were internally inconsistent; absence cannot be interpreted as no designation.");
    }
    if (status === "stale") {
      caveats.push("The source run used stale fallback evidence; current designation absence cannot be inferred.");
    }
    if (status === "unavailable") {
      caveats.push("The source product was unavailable; designation absence cannot be inferred.");
    }

    assertions.push({
      id: `coverage:${batch.sourceVersion.id}:${geography.id}:${entry.coverageKey}`,
      source_id: batch.sourceId,
      source_version_id: batch.sourceVersion.id,
      geography_id: geography.id,
      coverage_key: entry.coverageKey,
      status,
      records_matched: recordsMatched,
      evaluated_at: evaluatedAt,
      review_status: batch.sourceVersion.reviewStatus,
      caveat: caveats.length ? caveats.join(" ") : null,
    });
  }

  return assertions;
}
