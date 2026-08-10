import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import {
  BeginTransactionCommand,
  CommitTransactionCommand,
  ExecuteStatementCommand,
  RDSDataClient,
  RollbackTransactionCommand,
} from "@aws-sdk/client-rds-data";
import { deterministicUuid } from "../src/ingestion/hash.ts";
import { activatedEvidenceSnapshotContentHash } from "../src/ingestion/snapshot-activation.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const dataRoot = path.join(packageRoot, "data", "national");
const activationOutputPath = path.join(repoRoot, "output", "evidence-activation.json");
const resourceArn = process.env.EVIDENCE_DATABASE_CLUSTER_ARN?.trim();
const secretArn = process.env.EVIDENCE_DATABASE_SECRET_ARN?.trim();
const database = process.env.EVIDENCE_DATABASE_NAME?.trim();
const expectedArn = process.env.EVIDENCE_EXPECTED_CLUSTER_ARN?.trim();
const artifactBucket = process.env.EVIDENCE_ARTIFACT_BUCKET?.trim();
if (!resourceArn || !secretArn || !database || resourceArn !== expectedArn) {
  throw new Error("The approved Evidence Data API target is unresolved.");
}
if (!artifactBucket || process.env.EVIDENCE_PRODUCTION_IMPORT_APPROVED !== "true") {
  throw new Error("The approved evidence import target or approval is unresolved.");
}

const client = new RDSDataClient({});
const base = { resourceArn, secretArn, database };
async function execute(sql: string, payload?: unknown, transactionId?: string) {
  return client.send(new ExecuteStatementCommand({
    ...base,
    sql,
    continueAfterTimeout: true,
    parameters: payload === undefined
      ? []
      : [{ name: "payload", value: { stringValue: JSON.stringify(payload) } }],
    transactionId,
  }));
}
async function chunks<T>(items: T[], size: number, callback: (items: T[]) => Promise<unknown>) {
  for (let index = 0; index < items.length; index += size) {
    await callback(items.slice(index, index + size));
  }
}
async function artifact<T>(name: string) {
  const bytes = await readFile(path.join(dataRoot, name));
  return {
    name,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    data: JSON.parse(bytes.toString("utf8")) as T,
  };
}

const geography = JSON.parse(gunzipSync(
  await readFile(path.join(dataRoot, "national-geography.v2025.json.gz")),
).toString("utf8")) as {
  geographies: Array<{ id: string; kind: string; geoid: string; releaseScope: string }>;
};
const countyIds = new Map(geography.geographies
  .filter((item) => item.kind === "county" && item.releaseScope === "primary_50_states_dc")
  .map((item) => [item.geoid, item.id]));
if (countyIds.size !== 3_144) throw new Error(`Expected 3,144 counties; found ${countyIds.size}.`);

type AcsArtifact = {
  schemaVersion: string;
  generatedAt: string;
  source: {
    officialUrl: string; releaseDate: string; retrievedAt: string;
    dataPeriod: { start: string; end: string };
    variables: Record<string, { unit: string; direction: string; universe: string }>;
  };
  countyCount: number;
  records: Record<string, Record<string, number | null>>;
};
type ContextArtifact = {
  schemaVersion: string; generatedAt: string; officialUrl: string; releaseDate: string;
  approvedVariables: Array<{
    id: string; label: string; unit: string; direction: string; year?: string;
    dataPeriod?: string; originalSource?: string; domain?: string; topic?: string;
  }>;
  countyCount: number;
  counties: Record<string, { observations: Array<{
    variableId: string; label: string; value: string | number | null; unit: string;
    direction: string; year?: string; dataPeriod?: string; uncertainty?: number | null;
    originalSource?: string; domain?: string; topic?: string;
  }> }>;
};
type HrsaArtifact = {
  schemaVersion: string; generatedAt: string; officialUrl: string; countyCount: number;
  counties: Record<string, {
    hpsa: Array<Record<string, string | number | boolean | null>>;
    muaP: Array<Record<string, string | number | boolean | null>>;
  }>;
};
type LocalPlanArtifact = {
  countyCount: number;
  counties: Array<{
    countyGeoid: string; verificationStatus: string; publicationCoverageStatus: string;
    candidates: unknown[];
  }>;
};

const acs = await artifact<AcsArtifact>("acs-county-context.v1.json");
const ahrf = await artifact<ContextArtifact>("ahrf-county-context.v1.json");
const ahrq = await artifact<ContextArtifact>("ahrq-clh-county-context.v1.json");
const hrsa = await artifact<HrsaArtifact>("hrsa-county-context.v1.json");
const localPlans = await artifact<LocalPlanArtifact>("local-plan-coverage-directory.v1.json");
for (const item of [acs.data, ahrf.data, ahrq.data, hrsa.data, localPlans.data]) {
  if (item.countyCount !== 3_144) throw new Error("A national context artifact is incomplete.");
}

const sourceVersions = [
  {
    sourceId: "census-acs5", artifact: acs, releaseDate: acs.data.source.releaseDate,
    periodStart: acs.data.source.dataPeriod.start, periodEnd: acs.data.source.dataPeriod.end,
    officialUrl: acs.data.source.officialUrl, retrievedAt: acs.data.source.retrievedAt,
    mappingVersion: "acs5.county-context.provenance.v2",
  },
  {
    sourceId: "ahrf-workforce", artifact: ahrf, releaseDate: ahrf.data.releaseDate,
    periodStart: "2023-01-01", periodEnd: "2024-12-31",
    officialUrl: ahrf.data.officialUrl, retrievedAt: ahrf.data.generatedAt,
    mappingVersion: "ahrf.county-context.v1",
  },
  {
    sourceId: "ahrq-clh", artifact: ahrq, releaseDate: ahrq.data.releaseDate,
    periodStart: "2023-01-01", periodEnd: "2023-12-31",
    officialUrl: ahrq.data.officialUrl, retrievedAt: ahrq.data.generatedAt,
    mappingVersion: "ahrq-clh.county-context.v1",
  },
  {
    sourceId: "hrsa-workforce", artifact: hrsa, releaseDate: hrsa.data.generatedAt.slice(0, 10),
    periodStart: null, periodEnd: hrsa.data.generatedAt.slice(0, 10),
    officialUrl: hrsa.data.officialUrl, retrievedAt: hrsa.data.generatedAt,
    mappingVersion: "hrsa.designation-context.v1",
  },
].map((record) => ({
  ...record,
  id: deterministicUuid(
    "source-version",
    record.sourceId,
    record.releaseDate,
    record.artifact.sha256,
    record.mappingVersion,
  ),
  schemaVersion: record.artifact.data.schemaVersion + "+" + record.mappingVersion,
}));
await execute(`
  INSERT INTO evidence.source_version (
    id, source_id, release_label, release_date, data_period_start, data_period_end,
    retrieved_at, stale_after, official_url, content_hash, schema_version,
    review_status, reviewed_by, reviewed_at
  )
  SELECT CAST(x.id AS uuid), x.source_id, x.release_label, CAST(x.release_date AS date),
    CAST(x.period_start AS date), CAST(x.period_end AS date), CAST(x.retrieved_at AS timestamptz),
    CAST(x.stale_after AS timestamptz), x.official_url, x.content_hash, x.schema_version,
    'verified'::evidence.review_status, 'Oluwabiyi Adeyemo', now()
  FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
    id text, source_id text, release_label text, release_date text, period_start text,
    period_end text, retrieved_at text, stale_after text, official_url text,
    content_hash text, schema_version text
  )
  ON CONFLICT (id) DO NOTHING
`, sourceVersions.map((record) => ({
  id: record.id,
  source_id: record.sourceId,
  release_label: `${record.sourceId} ${record.releaseDate}`,
  release_date: record.releaseDate,
  period_start: record.periodStart,
  period_end: record.periodEnd,
  retrieved_at: record.retrievedAt,
  stale_after: `${Number(record.releaseDate.slice(0, 4)) + 2}-12-31T23:59:59.000Z`,
  official_url: record.officialUrl,
  content_hash: `sha256:${record.artifact.sha256}`,
  schema_version: record.schemaVersion,
})));
const versionBySource = new Map(sourceVersions.map((item) => [item.sourceId, item]));

type Definition = {
  sourceId: string; measureId: string; name: string; description: string;
  direction: "adverse" | "protective" | "contextual"; unit: "percent" | "count" | "rate" | "index";
  universe: string;
};
const acsFields = [
  ["population", "populationMoe", "Population", "count", "contextual"],
  ["medianAge", "medianAgeMoe", "Median age", "index", "contextual"],
  ["povertyPercent", "povertyPercentMoe", "Population below the poverty threshold", "percent", "adverse"],
  ["noVehiclePercent", "noVehiclePercentMoe", "Households without a vehicle", "percent", "adverse"],
  ["internetSubscriptionPercent", "internetSubscriptionPercentMoe", "Households with an internet subscription", "percent", "protective"],
] as const;
type AcsField = (typeof acsFields)[number][0];

const acsProvenance: Record<AcsField, {
  sourceVariableId: string | null;
  numeratorVariableId: string | null;
  denominatorVariableId: string | null;
  formula: string | null;
  transformationVersion: string | null;
  table: string;
  group: string;
  estimateField: string;
  marginOfErrorField: string | null;
  numeratorMarginOfErrorVariableId: string | null;
  denominatorMarginOfErrorVariableId: string | null;
  marginOfErrorFormula: string | null;
}> = {
  population: {
    sourceVariableId: "B01001_001E", numeratorVariableId: null, denominatorVariableId: null,
    formula: null, transformationVersion: null, table: "B01001", group: "B01001",
    estimateField: "B01001_001E", marginOfErrorField: "B01001_001M",
    numeratorMarginOfErrorVariableId: null, denominatorMarginOfErrorVariableId: null,
    marginOfErrorFormula: null,
  },
  medianAge: {
    sourceVariableId: "B01002_001E", numeratorVariableId: null, denominatorVariableId: null,
    formula: null, transformationVersion: null, table: "B01002", group: "B01002",
    estimateField: "B01002_001E", marginOfErrorField: "B01002_001M",
    numeratorMarginOfErrorVariableId: null, denominatorMarginOfErrorVariableId: null,
    marginOfErrorFormula: null,
  },
  povertyPercent: {
    sourceVariableId: null, numeratorVariableId: "B17001_002E", denominatorVariableId: "B17001_001E",
    formula: "(B17001_002E / B17001_001E) * 100", transformationVersion: "sozorock.percentage.v1",
    table: "B17001", group: "B17001", estimateField: "B17001_002E", marginOfErrorField: null,
    numeratorMarginOfErrorVariableId: "B17001_002M", denominatorMarginOfErrorVariableId: "B17001_001M",
    marginOfErrorFormula: "Census ACS proportion MOE using numerator and denominator margins of error, with additive ratio-MOE fallback when the proportion radicand is negative",
  },
  noVehiclePercent: {
    sourceVariableId: null, numeratorVariableId: "B08201_002E", denominatorVariableId: "B08201_001E",
    formula: "(B08201_002E / B08201_001E) * 100", transformationVersion: "sozorock.percentage.v1",
    table: "B08201", group: "B08201", estimateField: "B08201_002E", marginOfErrorField: null,
    numeratorMarginOfErrorVariableId: "B08201_002M", denominatorMarginOfErrorVariableId: "B08201_001M",
    marginOfErrorFormula: "Census ACS proportion MOE using numerator and denominator margins of error, with additive ratio-MOE fallback when the proportion radicand is negative",
  },
  internetSubscriptionPercent: {
    sourceVariableId: null, numeratorVariableId: "B28002_002E", denominatorVariableId: "B28002_001E",
    formula: "(B28002_002E / B28002_001E) * 100", transformationVersion: "sozorock.percentage.v1",
    table: "B28002", group: "B28002", estimateField: "B28002_002E", marginOfErrorField: null,
    numeratorMarginOfErrorVariableId: "B28002_002M", denominatorMarginOfErrorVariableId: "B28002_001M",
    marginOfErrorFormula: "Census ACS proportion MOE using numerator and denominator margins of error, with additive ratio-MOE fallback when the proportion radicand is negative",
  },
};
const definitions: Definition[] = acsFields.map(([field, , name, unit, direction]) => ({
  sourceId: "census-acs5", measureId: field, name,
  description: `${name} from the approved ACS 2020–2024 five-year county estimate.`,
  direction, unit, universe: acs.data.source.variables[field]?.universe ?? "Published ACS universe",
}));
function directionOf(value: string): Definition["direction"] {
  return value === "adverse" ? "adverse" : value === "protective" ? "protective" : "contextual";
}
function unitOf(value: string): Definition["unit"] {
  return value === "percent" ? "percent"
    : value.includes("per ") ? "rate"
      : value.includes("code") ? "index" : "count";
}
for (const [sourceId, source] of [["ahrf-workforce", ahrf.data], ["ahrq-clh", ahrq.data]] as const) {
  definitions.push(...source.approvedVariables.map((variable) => ({
    sourceId,
    measureId: variable.id,
    name: variable.label,
    description: `${variable.label}. ${sourceId === "ahrq-clh" ? "Approved AHRQ CLH variable." : "Approved AHRF variable."}`,
    direction: directionOf(variable.direction),
    unit: unitOf(variable.unit),
    universe: "County context defined by the source codebook",
  })));
}
await execute(`
  INSERT INTO evidence.measure_definition (
    id, source_id, source_measure_id, name, description, direction, unit,
    universe, adjustment, comparison_policy, review_status
  )
  SELECT CAST(x.id AS uuid), x.source_id, x.measure_id, x.name, x.description,
    CAST(x.direction AS evidence.metric_direction), x.unit, x.universe,
    'not_applicable', x.comparison_policy, 'verified'::evidence.review_status
  FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
    id text, source_id text, measure_id text, name text, description text,
    direction text, unit text, universe text, comparison_policy text
  )
  ON CONFLICT (source_id, source_measure_id) DO NOTHING
`, definitions.map((definition) => ({
  ...definition,
  id: deterministicUuid("measure", definition.sourceId, definition.measureId),
  source_id: definition.sourceId,
  measure_id: definition.measureId,
  comparison_policy: definition.direction === "adverse" ? "higher_is_concern"
    : definition.direction === "protective" ? "lower_is_concern" : "context_only",
})));

type Observation = {
  id: string; definitionId: string; geographyId: string; sourceVersionId: string;
  sourceRecordId: string; numericValue: number | null; valueJson: unknown; marginOfError: number | null;
  releaseDate: string; periodStart: string; periodEnd: string; sourceUrl: string; metadata: unknown;
  provenance?: (typeof acsProvenance)[AcsField];
};
const observations: Observation[] = [];
for (const [fips, record] of Object.entries(acs.data.records)) {
  const geographyId = countyIds.get(fips);
  if (!geographyId) continue;
  for (const [field, moeField] of acsFields) {
    const value = record[field];
    if (value === null || typeof value !== "number") continue;
    observations.push({
      id: deterministicUuid(
        "context-observation",
        versionBySource.get("census-acs5")!.id,
        fips,
        field,
        acs.data.source.releaseDate,
      ),
      definitionId: deterministicUuid("measure", "census-acs5", field),
      geographyId,
      sourceVersionId: versionBySource.get("census-acs5")!.id,
      sourceRecordId: `${fips}:${field}`,
      numericValue: value,
      valueJson: value,
      marginOfError: typeof record[moeField] === "number" ? record[moeField] : null,
      releaseDate: acs.data.source.releaseDate,
      periodStart: acs.data.source.dataPeriod.start,
      periodEnd: acs.data.source.dataPeriod.end,
      sourceUrl: acs.data.source.officialUrl,
      metadata: {
        countyFips: fips,
        field,
        ...acsProvenance[field],
      },
      provenance: acsProvenance[field],
    });
  }
}
for (const [sourceId, source] of [["ahrf-workforce", ahrf.data], ["ahrq-clh", ahrq.data]] as const) {
  const version = versionBySource.get(sourceId)!;
  for (const [fips, county] of Object.entries(source.counties)) {
    const geographyId = countyIds.get(fips);
    if (!geographyId) continue;
    for (const item of county.observations) {
      if (item.value === null) continue;
      const year = item.year ?? item.dataPeriod?.match(/\d{4}/)?.[0] ?? source.releaseDate.slice(0, 4);
      observations.push({
        id: deterministicUuid("context-observation", version.id, fips, item.variableId, year),
        definitionId: deterministicUuid("measure", sourceId, item.variableId),
        geographyId,
        sourceVersionId: version.id,
        sourceRecordId: `${fips}:${item.variableId}:${year}`,
        numericValue: typeof item.value === "number" ? item.value : null,
        valueJson: item.value,
        marginOfError: item.uncertainty ?? null,
        releaseDate: source.releaseDate,
        periodStart: `${year}-01-01`,
        periodEnd: `${year}-12-31`,
        sourceUrl: source.officialUrl,
        metadata: {
          countyFips: fips, variableId: item.variableId, originalSource: item.originalSource,
          domain: item.domain, topic: item.topic, uncertaintySupplied: item.uncertainty !== null,
        },
      });
    }
  }
}
await chunks(observations, 250, (batch) => execute(`
  INSERT INTO evidence.metric_observation (
    id, measure_definition_id, geography_id, source_version_id, value_json, numeric_value,
    confidence_low, confidence_high, margin_of_error, release_date, data_period_start,
    data_period_end, retrieved_at, review_status, source_record_id, source_url,
    geography_level, source_metadata, source_variable_id,
    source_numerator_variable_id, source_denominator_variable_id, source_formula,
    source_transformation_version, source_table, source_group, source_estimate_field,
    source_margin_of_error_field, source_numerator_margin_of_error_variable_id,
    source_denominator_margin_of_error_variable_id, source_margin_of_error_formula
  )
  SELECT CAST(x.id AS uuid), CAST(x.definition_id AS uuid), CAST(x.geography_id AS uuid),
    CAST(x.source_version_id AS uuid), CAST(x.value_json AS jsonb), x.numeric_value,
    NULL, NULL, x.margin_of_error, CAST(x.release_date AS date), CAST(x.period_start AS date),
    CAST(x.period_end AS date), now(), 'verified'::evidence.review_status, x.source_record_id,
    x.source_url, 'county', CAST(x.metadata AS jsonb), x.source_variable_id,
    x.source_numerator_variable_id, x.source_denominator_variable_id, x.source_formula,
    x.source_transformation_version, x.source_table, x.source_group, x.source_estimate_field,
    x.source_margin_of_error_field, x.source_numerator_margin_of_error_variable_id,
    x.source_denominator_margin_of_error_variable_id, x.source_margin_of_error_formula
  FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
    id text, definition_id text, geography_id text, source_version_id text,
    value_json text, numeric_value numeric, margin_of_error numeric, release_date text,
    period_start text, period_end text, source_record_id text, source_url text, metadata text,
    source_variable_id text, source_numerator_variable_id text,
    source_denominator_variable_id text, source_formula text,
    source_transformation_version text, source_table text, source_group text,
    source_estimate_field text, source_margin_of_error_field text,
    source_numerator_margin_of_error_variable_id text,
    source_denominator_margin_of_error_variable_id text,
    source_margin_of_error_formula text
  )
  ON CONFLICT DO NOTHING
`, batch.map((item) => ({
  id: item.id, definition_id: item.definitionId, geography_id: item.geographyId,
  source_version_id: item.sourceVersionId, value_json: JSON.stringify(item.valueJson),
  numeric_value: item.numericValue, margin_of_error: item.marginOfError,
  release_date: item.releaseDate, period_start: item.periodStart, period_end: item.periodEnd,
  source_record_id: item.sourceRecordId, source_url: item.sourceUrl,
  metadata: JSON.stringify(item.metadata),
  source_variable_id: item.provenance?.sourceVariableId ?? null,
  source_numerator_variable_id: item.provenance?.numeratorVariableId ?? null,
  source_denominator_variable_id: item.provenance?.denominatorVariableId ?? null,
  source_formula: item.provenance?.formula ?? null,
  source_transformation_version: item.provenance?.transformationVersion ?? null,
  source_table: item.provenance?.table ?? null,
  source_group: item.provenance?.group ?? null,
  source_estimate_field: item.provenance?.estimateField ?? null,
  source_margin_of_error_field: item.provenance?.marginOfErrorField ?? null,
  source_numerator_margin_of_error_variable_id: item.provenance?.numeratorMarginOfErrorVariableId ?? null,
  source_denominator_margin_of_error_variable_id: item.provenance?.denominatorMarginOfErrorVariableId ?? null,
  source_margin_of_error_formula: item.provenance?.marginOfErrorFormula ?? null,
}))));

function isoDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}
const designations = Object.entries(hrsa.data.counties).flatMap(([fips, county]) => {
  const geographyId = countyIds.get(fips);
  if (!geographyId) return [];
  return [...county.hpsa.map((item) => ({ family: "hpsa", item })),
    ...county.muaP.map((item) => ({ family: "mua_p", item }))].map(({ family, item }) => {
    const component = String(item.componentType ?? "");
    const type = String(item.designationType ?? item.populationType ?? "");
    const wholeCounty = item.wholeCounty === true;
    const sourceScope = wholeCounty ? "whole_county"
      : /facility/i.test(component) ? "facility"
        : /population/i.test(type) ? "population_group"
          : /subcounty|census tract|minor civil/i.test(component) ? "subcounty" : "other";
    const sourceRecordId = `${family}:${String(item.designationId ?? "")}:${fips}`;
    return {
      id: deterministicUuid(
        "workforce-designation",
        versionBySource.get("hrsa-workforce")!.id,
        sourceRecordId,
      ),
      geography_id: geographyId,
      source_version_id: versionBySource.get("hrsa-workforce")!.id,
      source_record_id: sourceRecordId,
      family,
      discipline: String(item.discipline ?? "Medical underservice"),
      designation_name: String(item.designationName ?? "HRSA designation"),
      designation_type: type || null,
      component_type: component || null,
      status: String(item.status ?? "Unknown"),
      score: typeof item.score === "number" ? item.score
        : typeof item.imuScore === "number" ? item.imuScore : null,
      designation_date: isoDate(item.designationDate),
      last_update_date: isoDate(item.lastUpdateDate),
      whole_county: wholeCounty,
      source_scope: sourceScope,
      metadata: JSON.stringify(item),
    };
  });
});
await chunks(designations, 200, (batch) => execute(`
  INSERT INTO evidence.workforce_designation (
    id, geography_id, source_version_id, source_record_id, designation_family,
    discipline, designation_name, designation_type, component_type, status, score,
    designation_date, last_update_date, whole_county, source_scope, review_status,
    source_metadata
  )
  SELECT CAST(x.id AS uuid), CAST(x.geography_id AS uuid), CAST(x.source_version_id AS uuid),
    x.source_record_id, x.family, x.discipline, x.designation_name, x.designation_type,
    x.component_type, x.status, x.score, CAST(x.designation_date AS date),
    CAST(x.last_update_date AS date), x.whole_county, x.source_scope,
    'verified'::evidence.review_status, CAST(x.metadata AS jsonb)
  FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
    id text, geography_id text, source_version_id text, source_record_id text,
    family text, discipline text, designation_name text, designation_type text,
    component_type text, status text, score numeric, designation_date text,
    last_update_date text, whole_county boolean, source_scope text, metadata text
  )
  ON CONFLICT DO NOTHING
`, batch));

const snapshotBytes = await readFile(path.join(dataRoot, "county-evidence-snapshot.v1.json"));
const snapshot = JSON.parse(snapshotBytes.toString("utf8")) as {
  snapshotId: string;
  generatedAt: string;
  policyVersion: string;
};
const baseSnapshotContentHash = snapshot.snapshotId.replace(/^snapshot:/, "sha256:");
const baseSnapshotUuid = deterministicUuid("evidence-snapshot", baseSnapshotContentHash);
const activatedSnapshotContentHash = activatedEvidenceSnapshotContentHash({
  baseSnapshotContentHash,
  contractVersion: "explore.place-brief.v1",
  policyVersion: snapshot.policyVersion,
  sources: sourceVersions.map((source) => ({
    sourceId: source.sourceId,
    sourceVersionId: source.id,
    mappingVersion: source.mappingVersion,
  })),
});
const snapshotUuid = deterministicUuid("evidence-snapshot", activatedSnapshotContentHash);

const localPlanByCounty = new Map(localPlans.data.counties.map((item) => [item.countyGeoid, item]));
const coverage = [...countyIds.entries()].flatMap(([fips, geographyId]) => {
  const acsCount = acsFields.filter(([field]) => typeof acs.data.records[fips]?.[field] === "number").length;
  const ahrfCount = ahrf.data.counties[fips]?.observations.filter((item) => item.value !== null).length ?? 0;
  const ahrqCount = ahrq.data.counties[fips]?.observations.filter((item) => item.value !== null).length ?? 0;
  const hrsaCount = (hrsa.data.counties[fips]?.hpsa.length ?? 0) + (hrsa.data.counties[fips]?.muaP.length ?? 0);
  const local = localPlanByCounty.get(fips);
  return [
    ["census-acs5", versionBySource.get("census-acs5")!.id, acsCount ? "available" : "unavailable_from_source", acsCount, "Approved ACS five-year county observations."],
    ["ahrf-workforce", versionBySource.get("ahrf-workforce")!.id, ahrfCount ? "available" : "unavailable_from_source", ahrfCount, "Approved AHRF county context."],
    ["ahrq-clh", versionBySource.get("ahrq-clh")!.id, ahrqCount ? "available" : "unavailable_from_source", ahrqCount, "Human-approved AHRQ CLH county variables."],
    ["hrsa-workforce", versionBySource.get("hrsa-workforce")!.id, hrsaCount ? "available" : "unavailable_from_source", hrsaCount, hrsaCount ? "HRSA designations are associated with this county; scope is retained per record." : "No compatible designation row was available from this HRSA snapshot."],
    ["local-planning-documents", null, local?.verificationStatus === "verified" ? "available" : local?.candidates.length ? "awaiting_human_review" : "not_yet_verified", local?.candidates.length ?? 0, local?.verificationStatus === "verified" ? "Verified local planning evidence is available." : "Current local planning evidence: not yet verified."],
  ].map(([sourceId, sourceVersionId, status, count, reason]) => ({
    geography_id: geographyId, source_id: sourceId, source_version_id: sourceVersionId,
    status, count, reason, fips,
  }));
});
for (const record of sourceVersions) {
  const importIdempotencyHash = createHash("sha256")
    .update(record.artifact.sha256 + "|" + record.id)
    .digest("hex");
  await execute(`
    INSERT INTO evidence.import_manifest (
      id, source_id, source_version_id, artifact_url, artifact_object_key,
      artifact_sha256, byte_length, record_count, schema_version, imported_at,
      idempotency_key, metadata
    ) VALUES (
      CAST('${deterministicUuid("import-manifest", record.artifact.name, record.artifact.sha256, record.id)}' AS uuid),
      '${record.sourceId}', CAST('${record.id}' AS uuid),
      'https://${artifactBucket}.s3.amazonaws.com/${record.artifact.name}',
      '${record.artifact.name}', '${record.artifact.sha256}', ${record.artifact.bytes.byteLength},
      3144, '${record.schemaVersion}', now(),
      'sha256:${importIdempotencyHash}',
      jsonb_build_object('releaseScope', 'primary_50_states_dc', 'mappingVersion', '${record.mappingVersion}')
    ) ON CONFLICT (idempotency_key) DO NOTHING
  `);
}

const opened = await client.send(new BeginTransactionCommand(base));
if (!opened.transactionId) throw new Error("The evidence activation transaction could not be opened.");
try {
  await execute(`
    INSERT INTO evidence.evidence_snapshot (
      id, contract_version, policy_version, created_at, published_at, content_hash,
      review_status, reviewed_by, reviewed_at
    ) VALUES (
      CAST('${snapshotUuid}' AS uuid), 'explore.place-brief.v1', '${snapshot.policyVersion}',
      CAST('${snapshot.generatedAt}' AS timestamptz), now(), '${activatedSnapshotContentHash}',
      'verified', 'Oluwabiyi Adeyemo', now()
    ) ON CONFLICT (id) DO NOTHING
  `, undefined, opened.transactionId);
  await execute(`
    INSERT INTO evidence.snapshot_source_version (snapshot_id, source_version_id)
    SELECT CAST('${snapshotUuid}' AS uuid), link.source_version_id
    FROM evidence.snapshot_source_version link
    JOIN evidence.source_version version ON version.id=link.source_version_id
    WHERE link.snapshot_id=CAST('${baseSnapshotUuid}' AS uuid)
      AND version.source_id IN ('census-geography', 'cdc-places')
    ON CONFLICT DO NOTHING
  `, undefined, opened.transactionId);
  await execute(`
    INSERT INTO evidence.snapshot_source_version (snapshot_id, source_version_id)
    SELECT CAST('${snapshotUuid}' AS uuid), CAST(x.id AS uuid)
    FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(id text)
    ON CONFLICT DO NOTHING
  `, sourceVersions.map(({ id }) => ({ id })), opened.transactionId);
  await execute(`
    INSERT INTO evidence.source_coverage (
      snapshot_id, geography_id, source_id, source_version_id, status, reason,
      observed_at, data_period_start, data_period_end, observation_count, metadata
    )
    SELECT CAST('${snapshotUuid}' AS uuid), geography_id, source_id,
      source_version_id, status, reason, observed_at, data_period_start,
      data_period_end, observation_count, metadata
    FROM evidence.source_coverage
    WHERE snapshot_id=CAST('${baseSnapshotUuid}' AS uuid)
      AND source_id IN ('census-geography', 'cdc-places')
    ON CONFLICT (snapshot_id, geography_id, source_id) DO NOTHING
  `, undefined, opened.transactionId);
  await chunks(coverage, 300, (batch) => execute(`
    INSERT INTO evidence.source_coverage (
      snapshot_id, geography_id, source_id, source_version_id, status, reason,
      observed_at, observation_count, metadata
    )
    SELECT CAST('${snapshotUuid}' AS uuid), CAST(x.geography_id AS uuid), x.source_id,
      CASE WHEN x.source_version_id IS NULL THEN NULL ELSE CAST(x.source_version_id AS uuid) END,
      CAST(x.status AS evidence.source_coverage_status), x.reason, now(), x.count,
      jsonb_build_object('countyFips', x.fips)
    FROM jsonb_to_recordset(CAST(:payload AS jsonb)) AS x(
      geography_id text, source_id text, source_version_id text, status text,
      count integer, reason text, fips text
    )
    ON CONFLICT (snapshot_id, geography_id, source_id) DO NOTHING
  `, batch, opened.transactionId));
  await client.send(new CommitTransactionCommand({ ...base, transactionId: opened.transactionId }));
} catch (error) {
  await client.send(new RollbackTransactionCommand({ ...base, transactionId: opened.transactionId }));
  throw error;
}

await mkdir(path.dirname(activationOutputPath), { recursive: true });
await writeFile(activationOutputPath, JSON.stringify({
  schemaVersion: "evidence-activation.v1",
  baseSnapshotContentHash,
  contentHash: activatedSnapshotContentHash,
  snapshotId: snapshotUuid,
  sourceVersions: sourceVersions.map(({ sourceId, id, mappingVersion, schemaVersion }) => ({
    sourceId,
    sourceVersionId: id,
    mappingVersion,
    schemaVersion,
  })),
}) + "\n", "utf8");

console.log(JSON.stringify({
  activatedSnapshotContentHash,
  activatedSnapshotId: snapshotUuid,
  database,
  countyCount: countyIds.size,
  observationCount: observations.length,
  workforceDesignationCount: designations.length,
  coverageRowCount: coverage.length,
  sourceVersions: Object.fromEntries(sourceVersions.map((item) => [item.sourceId, item.id])),
}, null, 2));
