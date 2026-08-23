import {
  buildEvidenceGatewayResponseV1,
  type EvidenceGatewayResponseV1,
  type GatewaySourceCoverageAssertion,
  type GatewaySourceCoverageStatus,
  type Geography,
  type MeasureDefinition,
  type MetricObservation,
  type ReviewStatus,
  type SourceCatalogRecord,
  type SourceVersion,
} from "@sozorock/evidence-core";
import {
  evidenceFieldValue,
  executeEvidenceSql,
  requireEvidenceGeographyId,
  requirePublishedEvidenceSnapshot,
} from "./evidence-runtime-authority";

type Row = unknown[];

function field(row: Row | undefined, index: number) {
  return evidenceFieldValue(row?.[index] as Parameters<typeof evidenceFieldValue>[0]);
}

function text(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function jsonArray(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function primitiveRecord(value: unknown): Record<string, string | number | boolean | null> {
  if (typeof value !== "string" || !value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, item]) =>
        item === null || ["string", "number", "boolean"].includes(typeof item),
      ),
    ) as Record<string, string | number | boolean | null>;
  } catch {
    return {};
  }
}

function primitiveValue(value: unknown): number | string | boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    return typeof value === "number" || typeof value === "boolean" ? value : String(value);
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed === null || typeof parsed === "number" || typeof parsed === "string" || typeof parsed === "boolean") {
      return parsed;
    }
    return JSON.stringify(parsed);
  } catch {
    return value;
  }
}

export function normalizePublishedCoverageStatus(
  operationalStatus: string,
  recordsMatched: number,
): GatewaySourceCoverageStatus {
  if (operationalStatus === "available") {
    return recordsMatched > 0 ? "complete_with_records" : "complete_no_records";
  }
  if (operationalStatus === "partially_available") return "partial";
  if (operationalStatus === "stale") return "stale";
  return "unavailable";
}

export async function getPublishedEvidenceGateway(
  countyGeoid: string,
  expectedSnapshotHash: string,
): Promise<EvidenceGatewayResponseV1 | null> {
  if (!/^\d{5}$/.test(countyGeoid)) throw new Error("County GEOID is invalid.");

  const authority = await requirePublishedEvidenceSnapshot(expectedSnapshotHash);
  const geographyId = await requireEvidenceGeographyId(countyGeoid, authority.snapshotContentHash);

  const snapshotResult = await executeEvidenceSql(
    `SELECT created_at::text
       FROM evidence.evidence_snapshot
      WHERE id=CAST(:snapshot_id AS uuid)
        AND content_hash=:snapshot_hash
        AND review_status='verified'
        AND published_at IS NOT NULL
      LIMIT 1`,
    [
      { name: "snapshot_id", value: { stringValue: authority.snapshotUuid } },
      { name: "snapshot_hash", value: { stringValue: authority.snapshotContentHash } },
    ],
  );
  const generatedAt = text(field(snapshotResult.records?.[0], 0));
  if (!generatedAt) return null;

  const schemaResult = await executeEvidenceSql(
    `SELECT migration_name
       FROM evidence.schema_migration
      ORDER BY migration_name DESC
      LIMIT 1`,
  );
  const latestMigration = text(field(schemaResult.records?.[0], 0));
  if (!latestMigration) throw new Error("Evidence schema version is unavailable.");

  const geographyResult = await executeEvidenceSql(
    `SELECT id::text, kind::text, authority, authority_id, name, display_name,
            state_fips, county_fips, vintage, valid_from::text, valid_to::text,
            review_status::text, caveat
       FROM evidence.geography
      WHERE id=CAST(:geography_id AS uuid)
        AND review_status='verified'
      LIMIT 1`,
    [{ name: "geography_id", value: { stringValue: geographyId } }],
  );
  const geographyRow = geographyResult.records?.[0];
  if (!geographyRow) return null;
  const geography: Geography = {
    id: text(field(geographyRow, 0)),
    kind: text(field(geographyRow, 1)) as Geography["kind"],
    authority: text(field(geographyRow, 2)) as Geography["authority"],
    authorityId: text(field(geographyRow, 3)),
    name: text(field(geographyRow, 4)),
    displayName: text(field(geographyRow, 5)),
    stateFips: field(geographyRow, 6) === null ? null : text(field(geographyRow, 6)),
    countyFips: field(geographyRow, 7) === null ? null : text(field(geographyRow, 7)),
    vintage: text(field(geographyRow, 8)),
    validFrom: field(geographyRow, 9) === null ? null : text(field(geographyRow, 9)),
    validTo: field(geographyRow, 10) === null ? null : text(field(geographyRow, 10)),
    reviewStatus: text(field(geographyRow, 11), "verified") as ReviewStatus,
    caveat: field(geographyRow, 12) === null ? null : text(field(geographyRow, 12)),
  };

  const sourceResult = await executeEvidenceSql(
    `SELECT source.id, source.family, source.publisher, source.title, source.official_url,
            source.host_policy, array_to_json(source.allowed_hosts)::text,
            source.refresh_cadence, array_to_json(source.geography_kinds)::text,
            source.review_status::text, source.limitations::text,
            version.id::text, version.release_label, version.release_date::text,
            version.data_period_start::text, version.data_period_end::text,
            version.retrieved_at::text, version.stale_after::text, version.official_url,
            version.content_hash, version.schema_version, version.review_status::text,
            version.reviewed_by, version.reviewed_at::text
       FROM evidence.snapshot_source_version link
       JOIN evidence.source_version version ON version.id=link.source_version_id
       JOIN evidence.source_catalog source ON source.id=version.source_id
      WHERE link.snapshot_id=CAST(:snapshot_id AS uuid)
        AND version.review_status='verified'
      ORDER BY source.id, version.release_date DESC, version.id`,
    [{ name: "snapshot_id", value: { stringValue: authority.snapshotUuid } }],
  );
  const sourceCatalogById = new Map<string, SourceCatalogRecord>();
  const sourceVersions: SourceVersion[] = [];
  for (const row of sourceResult.records ?? []) {
    const sourceId = text(field(row, 0));
    sourceCatalogById.set(sourceId, {
      id: sourceId,
      family: text(field(row, 1)) as SourceCatalogRecord["family"],
      publisher: text(field(row, 2)),
      title: text(field(row, 3)),
      officialUrl: text(field(row, 4)),
      hostPolicy: text(field(row, 5)) as SourceCatalogRecord["hostPolicy"],
      allowedHosts: jsonArray(field(row, 6)),
      refreshCadence: text(field(row, 7)) as SourceCatalogRecord["refreshCadence"],
      geographyKinds: jsonArray(field(row, 8)) as SourceCatalogRecord["geographyKinds"],
      reviewStatus: text(field(row, 9), "verified") as ReviewStatus,
      limitations: jsonArray(field(row, 10)),
    });
    sourceVersions.push({
      id: text(field(row, 11)),
      sourceId,
      releaseLabel: text(field(row, 12)),
      releaseDate: text(field(row, 13)),
      dataPeriodStart: field(row, 14) === null ? null : text(field(row, 14)),
      dataPeriodEnd: field(row, 15) === null ? null : text(field(row, 15)),
      retrievedAt: text(field(row, 16)),
      staleAfter: field(row, 17) === null ? text(field(row, 16)) : text(field(row, 17)),
      officialUrl: text(field(row, 18)),
      contentHash: text(field(row, 19)),
      schemaVersion: text(field(row, 20)),
      reviewStatus: text(field(row, 21), "verified") as ReviewStatus,
      reviewedBy: field(row, 22) === null ? null : text(field(row, 22)),
      reviewedAt: field(row, 23) === null ? null : text(field(row, 23)),
    });
  }
  if (!sourceVersions.length) return null;

  const observationResult = await executeEvidenceSql(
    `SELECT observation.id::text, definition.id::text, definition.source_measure_id,
            definition.name, definition.description, definition.direction::text,
            definition.higher_value_meaning::text, definition.unit, definition.universe,
            definition.adjustment, definition.comparison_policy, definition.review_status::text,
            observation.source_version_id::text, observation.source_record_id,
            observation.source_url, observation.geography_level,
            observation.value_json::text, observation.numeric_value,
            observation.confidence_low, observation.confidence_high, observation.margin_of_error,
            observation.release_date::text, observation.data_period_start::text,
            observation.data_period_end::text, observation.retrieved_at::text,
            observation.review_status::text, observation.suppression_reason,
            observation.source_metadata::text
       FROM evidence.metric_observation observation
       JOIN evidence.measure_definition definition ON definition.id=observation.measure_definition_id
       JOIN evidence.snapshot_source_version link ON link.source_version_id=observation.source_version_id
      WHERE link.snapshot_id=CAST(:snapshot_id AS uuid)
        AND observation.geography_id=CAST(:geography_id AS uuid)
        AND observation.review_status='verified'
        AND definition.review_status='verified'
      ORDER BY definition.source_measure_id, observation.source_record_id`,
    [
      { name: "snapshot_id", value: { stringValue: authority.snapshotUuid } },
      { name: "geography_id", value: { stringValue: geographyId } },
    ],
  );
  const definitionsById = new Map<string, MeasureDefinition>();
  const observations: MetricObservation[] = [];
  for (const row of observationResult.records ?? []) {
    const definitionId = text(field(row, 1));
    definitionsById.set(definitionId, {
      id: definitionId,
      sourceMeasureId: text(field(row, 2)),
      name: text(field(row, 3)),
      description: text(field(row, 4)),
      direction: text(field(row, 5), "unknown") as MeasureDefinition["direction"],
      higherValueMeaning: text(field(row, 6), "context_dependent") as MeasureDefinition["higherValueMeaning"],
      unit: text(field(row, 7), "index") as MeasureDefinition["unit"],
      universe: text(field(row, 8), "Published source universe"),
      adjustment: text(field(row, 9), "not_applicable") as MeasureDefinition["adjustment"],
      comparisonPolicy: text(field(row, 10), "not_rankable") as MeasureDefinition["comparisonPolicy"],
      reviewStatus: text(field(row, 11), "verified") as ReviewStatus,
    });
    observations.push({
      id: text(field(row, 0)),
      measureDefinitionId: definitionId,
      geographyId,
      sourceVersionId: text(field(row, 12)),
      sourceRecordId: text(field(row, 13)),
      sourceUrl: text(field(row, 14)),
      geographyLevel: text(field(row, 15), "county") as MetricObservation["geographyLevel"],
      value: primitiveValue(field(row, 16)),
      numericValue: numberValue(field(row, 17)),
      confidenceLow: numberValue(field(row, 18)),
      confidenceHigh: numberValue(field(row, 19)),
      marginOfError: numberValue(field(row, 20)),
      releaseDate: text(field(row, 21)),
      dataPeriodStart: field(row, 22) === null ? null : text(field(row, 22)),
      dataPeriodEnd: field(row, 23) === null ? null : text(field(row, 23)),
      retrievedAt: text(field(row, 24)),
      reviewStatus: text(field(row, 25), "verified") as ReviewStatus,
      suppressionReason: field(row, 26) === null ? null : text(field(row, 26)),
      sourceMetadata: primitiveRecord(field(row, 27)),
    });
  }

  const coverageResult = await executeEvidenceSql(
    `SELECT source_id, source_version_id::text, coverage_key, status::text,
            observation_count, observed_at::text, review_status::text, reason
       FROM evidence.source_coverage
      WHERE snapshot_id=CAST(:snapshot_id AS uuid)
        AND geography_id=CAST(:geography_id AS uuid)
        AND source_version_id IS NOT NULL
      ORDER BY source_id, coverage_key`,
    [
      { name: "snapshot_id", value: { stringValue: authority.snapshotUuid } },
      { name: "geography_id", value: { stringValue: geographyId } },
    ],
  );
  const sourceCoverage: GatewaySourceCoverageAssertion[] = [];
  for (const row of coverageResult.records ?? []) {
    const sourceId = text(field(row, 0));
    const sourceVersionId = text(field(row, 1));
    const coverageKey = text(field(row, 2));
    const recordsMatched = Number(field(row, 4) ?? 0);
    if (!sourceVersions.some((item) => item.id === sourceVersionId && item.sourceId === sourceId)) continue;
    sourceCoverage.push({
      id: `coverage:${sourceId}:${coverageKey}:${geographyId}:${sourceVersionId}`,
      source_id: sourceId,
      source_version_id: sourceVersionId,
      geography_id: geographyId,
      coverage_key: coverageKey,
      status: normalizePublishedCoverageStatus(text(field(row, 3)), recordsMatched),
      records_matched: recordsMatched,
      evaluated_at: text(field(row, 5)),
      review_status: text(field(row, 6), "provisional") as ReviewStatus,
      caveat: field(row, 7) === null ? null : text(field(row, 7)),
    });
  }

  return buildEvidenceGatewayResponseV1({
    releaseId: authority.snapshotContentHash.replace(/^sha256:/, "snapshot:"),
    generatedAt,
    evidenceCoreSchemaVersion: `evidence-core.${latestMigration.replace(/\.sql$/, "")}`,
    geographies: [geography],
    sourceCatalog: [...sourceCatalogById.values()],
    sourceVersions,
    measureDefinitions: [...definitionsById.values()],
    observations,
    sourceCoverage,
  });
}
