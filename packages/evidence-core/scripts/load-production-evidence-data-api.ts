import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import {
  ExecuteStatementCommand,
  RDSDataClient,
} from "@aws-sdk/client-rds-data";
import { SOURCE_CATALOG } from "../src/source-catalog.ts";
import { deterministicUuid } from "../src/ingestion/hash.ts";
import type { CountyEvidenceSnapshot } from "../src/national/county-brief.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = path.join(packageRoot, "data", "national");
const resourceArn = process.env.EVIDENCE_DATABASE_CLUSTER_ARN?.trim();
const secretArn = process.env.EVIDENCE_DATABASE_SECRET_ARN?.trim();
const database = process.env.EVIDENCE_DATABASE_NAME?.trim();
const expectedArn = process.env.EVIDENCE_EXPECTED_CLUSTER_ARN?.trim();
const artifactBucket = process.env.EVIDENCE_ARTIFACT_BUCKET?.trim();
if (!resourceArn || !secretArn || !database || resourceArn !== expectedArn) {
  throw new Error("The approved Evidence Data API target is unresolved.");
}
if (!artifactBucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(artifactBucket)) {
  throw new Error("The approved evidence artifact bucket is unresolved.");
}
if (process.env.EVIDENCE_PRODUCTION_IMPORT_APPROVED !== "true") {
  throw new Error("Production evidence import approval flag is required.");
}

const client = new RDSDataClient({});
const base = { resourceArn, secretArn, database };
const now = new Date().toISOString();
const metricDefinitions = {
  conditions: {
    highBloodPressure: ["BPHIGH", "High blood pressure", "adverse"],
    diabetes: ["DIABETES", "Diabetes", "adverse"],
    coronaryHeartDisease: ["CHD", "Coronary heart disease", "adverse"],
    stroke: ["STROKE", "Stroke", "adverse"],
    cancer: ["CANCER", "Cancer excluding skin cancer", "adverse"],
    asthma: ["CASTHMA", "Current asthma", "adverse"],
    copd: ["COPD", "Chronic obstructive pulmonary disease", "adverse"],
    depression: ["DEPRESSION", "Depression", "adverse"],
    obesity: ["OBESITY", "Obesity", "adverse"],
  },
  barriers: {
    uninsured: ["ACCESS2", "Adults without health insurance", "adverse"],
    transportation: ["LACKTRPT", "Lack of reliable transportation", "adverse"],
    foodInsecurity: ["FOODINSECU", "Food insecurity", "adverse"],
    housingInsecurity: ["HOUSINSECU", "Housing insecurity", "adverse"],
    utilityShutoff: ["SHUTUTILITY", "Utility shutoff or threat", "adverse"],
    loneliness: ["LONELINESS", "Loneliness", "adverse"],
    disability: ["DISABILITY", "Any disability", "contextual"],
  },
  prevention: {
    annualCheckup: ["CHECKUP", "Annual checkup", "protective"],
    dentalVisit: ["DENTAL", "Dental visit", "protective"],
    cholesterolScreening: ["CHOLSCREEN", "Cholesterol screening", "protective"],
    colorectalScreening: ["COLON_SCREEN", "Colorectal cancer screening", "protective"],
    mammography: ["MAMMOUSE", "Mammography use", "protective"],
  },
} as const;

async function execute(sql: string, payload?: unknown) {
  return client.send(new ExecuteStatementCommand({
    ...base,
    sql,
    continueAfterTimeout: true,
    parameters: payload === undefined
      ? []
      : [{ name: "payload", value: { stringValue: JSON.stringify(payload) } }],
  }));
}

async function chunks<T>(items: T[], size: number, callback: (items: T[]) => Promise<unknown>) {
  for (let index = 0; index < items.length; index += size) {
    await callback(items.slice(index, index + size));
  }
}

const geographyArtifact = JSON.parse(gunzipSync(
  await readFile(path.join(dataRoot, "national-geography.v2025.json.gz")),
).toString("utf8")) as {
  schemaVersion: string;
  generatedAt: string;
  sourceVintage: string;
  sources: Array<{ id: string; url: string; sha256: string }>;
  geographies: Array<{
    id: string;
    kind: string;
    geoid: string;
    name: string;
    displayName: string;
    stateFips: string | null;
    countyFips: string | null;
    vintage: string;
    releaseScope: string;
    legalStatisticalAreaCode: string | null;
    geographyTypeLabel: string;
    landAreaSquareMeters: number | null;
    waterAreaSquareMeters: number | null;
    internalPoint: { latitude: number; longitude: number } | null;
    geometryStatus: string;
    sourceUrl: string;
  }>;
  relationships: Array<{
    id: string;
    fromKind: string;
    fromGeoid: string;
    toKind: string;
    toGeoid: string;
    relationship: string;
    overlapAreaPercent: number | null;
    vintage: string;
    sourceUrl: string;
    caveat: string | null;
  }>;
};
const manifest = JSON.parse(await readFile(
  path.join(dataRoot, "import-manifest.v2025.json"),
  "utf8",
)) as {
  generatedAt: string;
  contentSha256: string;
  authoritativePrimaryCountyCount: number;
  sources: Array<{ id: string; url: string; sha256: string; byteLength: number }>;
};
const countySnapshot = JSON.parse(await readFile(
  path.join(dataRoot, "county-evidence-snapshot.v1.json"),
  "utf8",
)) as CountyEvidenceSnapshot;

const geographySourceVersionId = deterministicUuid(
  "source-version",
  "census-geography",
  geographyArtifact.sourceVintage,
  manifest.contentSha256,
);
const cdcSourceVersionId = deterministicUuid(
  "source-version",
  "cdc-places",
  countySnapshot.cdc.datasetId,
  countySnapshot.cdc.releaseDate,
);
const snapshotHash = countySnapshot.snapshotId.replace(/^snapshot:/, "sha256:");
const snapshotUuid = deterministicUuid("evidence-snapshot", snapshotHash);

await execute(`
  INSERT INTO evidence.source_catalog (
    id, family, publisher, title, official_url, host_policy, allowed_hosts,
    refresh_cadence, geography_kinds, review_status, limitations
  )
  SELECT
    x.id, x.family, x.publisher, x.title, x.official_url, x.host_policy,
    ARRAY(SELECT jsonb_array_elements_text(x.allowed_hosts))::text[],
    x.refresh_cadence,
    ARRAY(SELECT jsonb_array_elements_text(x.geography_kinds))::evidence.geography_kind[],
    CAST(x.review_status AS evidence.review_status), x.limitations
  FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
    id text, family text, publisher text, title text, official_url text,
    host_policy text, allowed_hosts jsonb, refresh_cadence text,
    geography_kinds jsonb, review_status text, limitations jsonb
  )
  ON CONFLICT (id) DO NOTHING
`, SOURCE_CATALOG.map((source) => ({
  ...source,
  official_url: source.officialUrl,
  host_policy: source.hostPolicy,
  allowed_hosts: source.allowedHosts,
  refresh_cadence: source.refreshCadence,
  geography_kinds: source.geographyKinds,
  review_status: source.reviewStatus,
})));

await execute(`
  INSERT INTO evidence.source_version (
    id, source_id, release_label, release_date, data_period_start, data_period_end,
    retrieved_at, stale_after, official_url, content_hash, schema_version,
    review_status, reviewed_by, reviewed_at
  )
  SELECT CAST(x.id AS uuid), x.source_id, x.release_label, CAST(x.release_date AS date),
    CAST(x.data_period_start AS date), CAST(x.data_period_end AS date),
    CAST(x.retrieved_at AS timestamptz), CAST(x.stale_after AS timestamptz),
    x.official_url, x.content_hash, x.schema_version,
    CAST(x.review_status AS evidence.review_status), x.reviewed_by,
    CAST(x.reviewed_at AS timestamptz)
  FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
    id text, source_id text, release_label text, release_date text,
    data_period_start text, data_period_end text, retrieved_at text, stale_after text,
    official_url text, content_hash text, schema_version text, review_status text,
    reviewed_by text, reviewed_at text
  )
  ON CONFLICT (id) DO NOTHING
`, [
  {
    id: geographySourceVersionId,
    source_id: "census-geography",
    release_label: `Census geography ${geographyArtifact.sourceVintage}`,
    release_date: `${geographyArtifact.sourceVintage}-01-01`,
    data_period_start: `${geographyArtifact.sourceVintage}-01-01`,
    data_period_end: `${geographyArtifact.sourceVintage}-12-31`,
    retrieved_at: geographyArtifact.generatedAt,
    stale_after: `${Number(geographyArtifact.sourceVintage) + 2}-01-01T00:00:00.000Z`,
    official_url: "https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html",
    content_hash: `sha256:${manifest.contentSha256}`,
    schema_version: geographyArtifact.schemaVersion,
    review_status: "verified",
    reviewed_by: "Oluwabiyi Adeyemo",
    reviewed_at: now,
  },
  {
    id: cdcSourceVersionId,
    source_id: "cdc-places",
    release_label: `CDC PLACES ${countySnapshot.cdc.releaseDate}`,
    release_date: countySnapshot.cdc.releaseDate,
    data_period_start: countySnapshot.cdc.dataPeriodStart,
    data_period_end: countySnapshot.cdc.dataPeriodEnd,
    retrieved_at: countySnapshot.cdc.retrievedAt,
    stale_after: "2027-12-31T23:59:59.000Z",
    official_url: countySnapshot.cdc.officialUrl,
    content_hash: snapshotHash,
    schema_version: countySnapshot.schemaVersion,
    review_status: "verified",
    reviewed_by: "Oluwabiyi Adeyemo",
    reviewed_at: now,
  },
]);

const flatDefinitions = Object.values(metricDefinitions).flatMap((group) =>
  Object.entries(group).map(([field, [measureId, label, direction]]) => ({
    id: deterministicUuid("measure", "cdc-places", `${measureId}:Crude`),
    source_measure_id: `${measureId}:Crude`,
    name: label,
    description: `${label}, crude modeled county prevalence from the approved CDC PLACES release.`,
    direction,
    higher_value_meaning: direction === "adverse"
      ? "adverse"
      : direction === "protective"
        ? "favorable"
        : "context_dependent",
    comparison_policy: direction === "adverse"
      ? "higher_is_concern"
      : direction === "protective"
        ? "lower_is_concern"
        : "context_only",
    field,
  })));
await execute(`
  INSERT INTO evidence.measure_definition (
    id, source_id, source_measure_id, name, description, direction,
    higher_value_meaning, unit, universe, adjustment, comparison_policy, review_status
  )
  SELECT CAST(x.id AS uuid), 'cdc-places', x.source_measure_id, x.name, x.description,
    CAST(x.direction AS evidence.metric_direction),
    CAST(x.higher_value_meaning AS evidence.higher_value_meaning),
    'percent', 'Eligible adult population defined by the CDC PLACES measure',
    'modeled', x.comparison_policy, 'verified'::evidence.review_status
  FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
    id text, source_measure_id text, name text, description text, direction text,
    higher_value_meaning text, comparison_policy text
  )
  ON CONFLICT (id) DO NOTHING
`, flatDefinitions);

await chunks(geographyArtifact.geographies, 300, (batch) => execute(`
  INSERT INTO evidence.geography (
    id, kind, authority, authority_id, name, display_name, state_fips, county_fips,
    vintage, review_status, caveat, point_on_surface, legal_statistical_area_code,
    geography_type_label, release_scope, geometry_source_url, geometry_status,
    land_area_square_meters, water_area_square_meters
  )
  SELECT CAST(x.id AS uuid), CAST(x.kind AS evidence.geography_kind), 'census',
    x.geoid, x.name, x.display_name, x.state_fips, x.county_fips, x.vintage,
    'verified'::evidence.review_status,
    CASE WHEN x.kind='zcta' THEN 'A Census ZCTA is a statistical approximation, not a USPS ZIP delivery boundary.' ELSE NULL END,
    CASE WHEN x.latitude IS NULL OR x.longitude IS NULL THEN NULL
      ELSE ST_SetSRID(ST_MakePoint(x.longitude, x.latitude), 4326) END,
    x.lsad, x.type_label, x.release_scope, x.source_url, x.geometry_status,
    x.land_area, x.water_area
  FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
    id text, kind text, geoid text, name text, display_name text, state_fips text,
    county_fips text, vintage text, latitude numeric, longitude numeric, lsad text,
    type_label text, release_scope text, source_url text, geometry_status text,
    land_area numeric, water_area numeric
  )
  ON CONFLICT (id) DO NOTHING
`, batch.map((item) => ({
  id: item.id,
  kind: item.kind,
  geoid: item.geoid,
  name: item.name,
  display_name: item.displayName,
  state_fips: item.stateFips,
  county_fips: item.countyFips,
  vintage: item.vintage,
  latitude: item.internalPoint?.latitude ?? null,
  longitude: item.internalPoint?.longitude ?? null,
  lsad: item.legalStatisticalAreaCode,
  type_label: item.geographyTypeLabel,
  release_scope: item.releaseScope,
  source_url: item.sourceUrl,
  geometry_status: item.geometryStatus,
  land_area: item.landAreaSquareMeters,
  water_area: item.waterAreaSquareMeters,
}))));

const aliases = geographyArtifact.geographies.flatMap((item) => [
  {
    id: deterministicUuid("geography-alias", item.id, "official", item.displayName),
    geography_id: item.id,
    alias: item.displayName,
    normalized_alias: item.displayName.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(),
    alias_type: "official",
  },
  {
    id: deterministicUuid("geography-alias", item.id, "search", item.geoid),
    geography_id: item.id,
    alias: item.geoid,
    normalized_alias: item.geoid,
    alias_type: "search",
  },
]);
await chunks(aliases, 400, (batch) => execute(`
  INSERT INTO evidence.geography_alias (
    id, geography_id, alias, normalized_alias, alias_type, source_version_id, review_status
  )
  SELECT CAST(x.id AS uuid), CAST(x.geography_id AS uuid), x.alias, x.normalized_alias,
    x.alias_type, CAST(:source_version_id AS uuid), 'verified'::evidence.review_status
  FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
    id text, geography_id text, alias text, normalized_alias text, alias_type text
  )
  ON CONFLICT DO NOTHING
`.replace(":source_version_id", `'${geographySourceVersionId}'`), batch));

const geographyKey = new Map(
  geographyArtifact.geographies.map((item) => [`${item.kind}:${item.geoid}`, item.id]),
);
const relationships = geographyArtifact.relationships.flatMap((item) => {
  const from = geographyKey.get(`${item.fromKind}:${item.fromGeoid}`);
  const to = geographyKey.get(`${item.toKind}:${item.toGeoid}`);
  if (!from || !to) return [];
  return [{
    id: item.id,
    from_id: from,
    to_id: to,
    kind: item.relationship,
    vintage: item.vintage,
    overlap_area: item.overlapAreaPercent,
    caveat: item.caveat,
  }];
});
await chunks(relationships, 300, (batch) => execute(`
  INSERT INTO evidence.geography_relationship (
    id, from_geography_id, to_geography_id, relationship_kind, source_version_id,
    vintage, overlap_area_percent, method, caveat, review_status
  )
  SELECT CAST(x.id AS uuid), CAST(x.from_id AS uuid), CAST(x.to_id AS uuid),
    x.kind, CAST('${geographySourceVersionId}' AS uuid), x.vintage, x.overlap_area,
    'Official Census relationship file or canonical state/county hierarchy',
    x.caveat, 'verified'::evidence.review_status
  FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
    id text, from_id text, to_id text, kind text, vintage text,
    overlap_area numeric, caveat text
  )
  ON CONFLICT DO NOTHING
`, batch));

const observations = countySnapshot.counties.flatMap((record) => {
  const geographyId = geographyKey.get(`county:${record.fips}`);
  if (!geographyId) return [];
  return Object.entries(metricDefinitions).flatMap(([groupName, group]) => {
    const values = record[groupName as "conditions" | "barriers" | "prevention"];
    return Object.entries(group).flatMap(([field, [measureId]]) => {
      const metric = values[field];
      if (!metric || metric.value === null) return [];
      const definitionId = deterministicUuid("measure", "cdc-places", `${measureId}:Crude`);
      return [{
        id: deterministicUuid("county-observation", countySnapshot.snapshotId, record.fips, measureId),
        definition_id: definitionId,
        geography_id: geographyId,
        source_record_id: `${record.fips}:${measureId}:Crude`,
        numeric_value: metric.value,
        confidence_low: metric.ci?.[0] ?? null,
        confidence_high: metric.ci?.[1] ?? null,
        source_metadata: JSON.stringify({
          datasetId: countySnapshot.cdc.datasetId,
          countyFips: record.fips,
          measureId,
          dataValueType: "Crude prevalence",
        }),
      }];
    });
  });
});
await chunks(observations, 250, (batch) => execute(`
  INSERT INTO evidence.metric_observation (
    id, measure_definition_id, geography_id, source_version_id, value_json,
    numeric_value, confidence_low, confidence_high, margin_of_error, release_date,
    data_period_start, data_period_end, retrieved_at, review_status,
    source_record_id, source_url, geography_level, source_metadata
  )
  SELECT CAST(x.id AS uuid), CAST(x.definition_id AS uuid), CAST(x.geography_id AS uuid),
    CAST('${cdcSourceVersionId}' AS uuid), to_jsonb(x.numeric_value), x.numeric_value,
    x.confidence_low, x.confidence_high, NULL, CAST('${countySnapshot.cdc.releaseDate}' AS date),
    CAST('${countySnapshot.cdc.dataPeriodStart}' AS date),
    CAST('${countySnapshot.cdc.dataPeriodEnd}' AS date),
    CAST('${countySnapshot.cdc.retrievedAt}' AS timestamptz),
    'verified'::evidence.review_status, x.source_record_id,
    '${countySnapshot.cdc.officialUrl}', 'county', CAST(x.source_metadata AS jsonb)
  FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
    id text, definition_id text, geography_id text, source_record_id text,
    numeric_value numeric, confidence_low numeric, confidence_high numeric,
    source_metadata text
  )
  ON CONFLICT DO NOTHING
`, batch));

await execute(`
  INSERT INTO evidence.evidence_snapshot (
    id, contract_version, policy_version, created_at, published_at, content_hash,
    review_status, reviewed_by, reviewed_at
  ) VALUES (
    CAST('${snapshotUuid}' AS uuid), 'explore.place-brief.v1',
    '${countySnapshot.policyVersion}', CAST('${countySnapshot.generatedAt}' AS timestamptz),
    now(), '${snapshotHash}', 'verified', 'Oluwabiyi Adeyemo', now()
  ) ON CONFLICT (id) DO NOTHING;
`);
await execute(`
  INSERT INTO evidence.snapshot_source_version (snapshot_id, source_version_id)
  VALUES
    (CAST('${snapshotUuid}' AS uuid), CAST('${geographySourceVersionId}' AS uuid)),
    (CAST('${snapshotUuid}' AS uuid), CAST('${cdcSourceVersionId}' AS uuid))
  ON CONFLICT DO NOTHING
`);

await chunks(countySnapshot.counties, 250, (batch) => execute(`
  INSERT INTO evidence.source_coverage (
    snapshot_id, geography_id, source_id, source_version_id, status, reason,
    observed_at, data_period_start, data_period_end, observation_count, metadata
  )
  SELECT CAST('${snapshotUuid}' AS uuid), CAST(x.geography_id AS uuid), x.source_id,
    CASE WHEN x.source_version_id IS NULL THEN NULL ELSE CAST(x.source_version_id AS uuid) END,
    CAST(x.status AS evidence.source_coverage_status), x.reason, now(),
    CAST(x.period_start AS date), CAST(x.period_end AS date), x.observation_count,
    CAST(x.metadata AS jsonb)
  FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
    geography_id text, source_id text, source_version_id text, status text,
    reason text, period_start text, period_end text, observation_count integer,
    metadata text
  )
  ON CONFLICT DO NOTHING
`, batch.flatMap((record) => {
  const geographyId = geographyKey.get(`county:${record.fips}`);
  if (!geographyId) return [];
  const cdcStatus = record.sourceStatus === "available"
    ? record.dataCoverage >= 100 ? "available" : "partially_available"
    : "unavailable_from_source";
  const sources = [
    ["census-geography", geographySourceVersionId, "available", "Official Census county geography is loaded.", `${geographyArtifact.sourceVintage}-01-01`, `${geographyArtifact.sourceVintage}-12-31`, 1],
    ["cdc-places", record.sourceStatus === "available" ? cdcSourceVersionId : null, cdcStatus, record.sourceStatus === "available" ? "Compatible approved county observations are available." : "No compatible county observations are available from this source.", countySnapshot.cdc.dataPeriodStart, countySnapshot.cdc.dataPeriodEnd, record.sourceStatus === "available" ? Math.round(record.dataCoverage * 21 / 100) : 0],
    ["census-acs5", null, "credential_blocked", "CENSUS_API_KEY is not yet configured in the approved ingestion runtime.", null, null, 0],
    ["hrsa-workforce", null, "not_yet_verified", "The approved HRSA release has not yet completed production verification.", null, null, 0],
    ["ahrq-clh", null, "awaiting_human_review", "Approved AHRQ variables await named human review.", null, null, 0],
    ["local-planning-documents", null, "not_yet_verified", "Current local planning evidence: not yet verified.", null, null, 0],
  ] as const;
  return sources.map(([sourceId, sourceVersionId, status, reason, periodStart, periodEnd, count]) => ({
    geography_id: geographyId,
    source_id: sourceId,
    source_version_id: sourceVersionId,
    status,
    reason,
    period_start: periodStart,
    period_end: periodEnd,
    observation_count: count,
    metadata: JSON.stringify({ countyFips: record.fips }),
  }));
})));

const artifacts = [
  "national-geography.v2025.json.gz",
  "county-index.v2025.json",
  "county-evidence-snapshot.v1.json",
  "import-manifest.v2025.json",
  "national-coverage-report.v1.json",
];
for (const artifact of artifacts) {
  const bytes = await readFile(path.join(dataRoot, artifact));
  const hash = createHash("sha256").update(bytes).digest("hex");
  await execute(`
    INSERT INTO evidence.import_manifest (
      id, source_id, source_version_id, artifact_url, artifact_object_key,
      artifact_sha256, byte_length, record_count, schema_version, imported_at,
      idempotency_key, metadata
    ) VALUES (
      CAST('${deterministicUuid("import-manifest", artifact, hash)}' AS uuid),
      'census-geography', CAST('${geographySourceVersionId}' AS uuid),
      'https://${artifactBucket}.s3.amazonaws.com/${artifact}',
      '${artifact}', '${hash}', ${bytes.byteLength},
      ${artifact.includes("county") ? manifest.authoritativePrimaryCountyCount : 1},
      '${geographyArtifact.schemaVersion}', now(), 'sha256:${hash}',
      CAST('{"releaseScope":"primary_50_states_dc"}' AS jsonb)
    ) ON CONFLICT (idempotency_key) DO NOTHING
  `);
}

await execute(`
  INSERT INTO evidence.capability_switch (
    capability_key, enabled, reason, updated_at, updated_by
  ) VALUES
    ('provider:openai_responses', false, 'Enabled only after staging and production safety acceptance.', now(), 'production-import'),
    ('narrative_generation', false, 'Enabled only after staging and production safety acceptance.', now(), 'production-import')
  ON CONFLICT (capability_key) DO UPDATE SET
    enabled=false,
    reason=EXCLUDED.reason,
    updated_at=EXCLUDED.updated_at,
    updated_by=EXCLUDED.updated_by
`);

console.log(JSON.stringify({
  database,
  snapshotUuid,
  snapshotHash,
  geographyCount: geographyArtifact.geographies.length,
  relationshipCount: relationships.length,
  countyCount: countySnapshot.counties.length,
  observationCount: observations.length,
  importedAt: now,
  capabilitiesEnabled: false,
}, null, 2));
