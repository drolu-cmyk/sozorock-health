import {
  createHash,
  randomUUID,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BatchExecuteStatementCommand,
  RDSDataClient,
  ExecuteStatementCommand,
  type BatchExecuteStatementCommandInput,
  type ExecuteStatementCommandInput,
  type Field,
  type SqlParameter,
} from "@aws-sdk/client-rds-data";

import { SOURCE_CATALOG } from "../src/source-catalog.ts";
import type { ReviewStatus } from "../src/contracts.ts";

type CountyMeasure = {
  id: string;
  sourceMeasureId: string;
  name: string;
  description: string;
  unit: "percent" | "count" | "rate" | "ratio" | "index" | "designation";
  universe: string;
  adjustment: "crude" | "age_adjusted" | "modeled" | "not_applicable";
  direction: "adverse" | "protective" | "contextual" | "unknown";
  higherValueMeaning: "favorable" | "adverse" | "neutral" | "context_dependent";
  comparisonPolicy: "higher_is_concern" | "lower_is_concern" | "context_only" | "not_rankable";
  value: number | string | boolean | null;
  numericValue: number | null;
  confidenceLow?: number | null;
  confidenceHigh?: number | null;
  marginOfError?: number | null;
  geographyLevel?: string | null;
  dataPeriodStart?: string | null;
  dataPeriodEnd?: string | null;
  sourceMetadata?: Record<string, string | number | boolean | null>;
};

type WorkforceDesignation = {
  designationId: string;
  designationName: string;
  designationType: string;
  componentType: string;
  discipline?: string | null;
  populationType?: string | null;
  status: string;
  score?: number | null;
  imuScore?: number | null;
  designationDate?: string | null;
  lastUpdateDate?: string | null;
  wholeCounty?: boolean;
  sourceScope?: string | null;
  sourceMetadata?: Record<string, string | number | boolean | null>;
};

type CountyContext = {
  fips: string;
  acs: CountyMeasure[];
  hpsa: WorkforceDesignation[];
  muaP: WorkforceDesignation[];
  ahrf: CountyMeasure[];
  ahrq: CountyMeasure[];
};

type NationalContextArtifact = {
  schemaVersion: string;
  generatedAt: string;
  countyCount: number;
  sources: Record<string, {
    sourceId: string;
    sourceVersionId: string;
    officialUrl: string;
    releaseLabel: string;
    releaseDate: string;
    dataPeriodStart: string | null;
    dataPeriodEnd: string | null;
    retrievedAt: string;
    staleAfter: string;
    contentHash: string;
    schemaVersion: string;
    reviewStatus: ReviewStatus;
  }>;
  counties: CountyContext[];
};

const SCRIPT_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)));
const DEFAULT_ARTIFACT = resolve(SCRIPT_DIR, "../generated/national-context.json");
const DATABASE = process.env.EVIDENCE_DATABASE_NAME ?? "postgres";
const RESOURCE_ARN = process.env.EVIDENCE_DB_CLUSTER_ARN ?? process.env.AURORA_CLUSTER_ARN ?? "";
const SECRET_ARN = process.env.EVIDENCE_DB_SECRET_ARN ?? process.env.AURORA_SECRET_ARN ?? "";
const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
const SNAPSHOT_HASH = (process.env.EVIDENCE_SNAPSHOT_CONTENT_HASH ?? "").trim();
const ARTIFACT_PATH = resolve(process.cwd(), process.argv[2] ?? DEFAULT_ARTIFACT);

if (!RESOURCE_ARN || !SECRET_ARN) {
  throw new Error("EVIDENCE_DB_CLUSTER_ARN/AURORA_CLUSTER_ARN and EVIDENCE_DB_SECRET_ARN/AURORA_SECRET_ARN are required.");
}
if (!/^sha256:[0-9a-fA-F]{64}$/.test(SNAPSHOT_HASH)) {
  throw new Error("EVIDENCE_SNAPSHOT_CONTENT_HASH must be the approved sha256 snapshot hash.");
}

const rds = new RDSDataClient({ region: AWS_REGION });
const BATCH_SIZE = 100;
const pendingBatches = new Map<string, SqlParameter[][]>();

function sqlValue(value: unknown): Field {
  if (value === null || value === undefined) return { isNull: true };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { longValue: value } : { doubleValue: value };
  }
  return { stringValue: String(value) };
}

function param(name: string, value: unknown): SqlParameter {
  return { name, value: sqlValue(value) };
}

async function execute(
  sql: string,
  parameters: SqlParameter[] = [],
  transactionId?: string,
) {
  const input: ExecuteStatementCommandInput = {
    resourceArn: RESOURCE_ARN,
    secretArn: SECRET_ARN,
    database: DATABASE,
    sql,
    parameters,
    includeResultMetadata: true,
  };
  if (transactionId) input.transactionId = transactionId;
  return rds.send(new ExecuteStatementCommand(input));
}

async function flushBatch(sql: string) {
  const parameterSets = pendingBatches.get(sql) ?? [];
  if (!parameterSets.length) return;
  pendingBatches.set(sql, []);
  const input: BatchExecuteStatementCommandInput = {
    resourceArn: RESOURCE_ARN,
    secretArn: SECRET_ARN,
    database: DATABASE,
    sql,
    parameterSets,
  };
  await rds.send(new BatchExecuteStatementCommand(input));
}

async function enqueue(sql: string, parameters: SqlParameter[]) {
  const pending = pendingBatches.get(sql) ?? [];
  pending.push(parameters);
  pendingBatches.set(sql, pending);
  if (pending.length >= BATCH_SIZE) await flushBatch(sql);
}

async function flushAllBatches() {
  for (const sql of pendingBatches.keys()) await flushBatch(sql);
}

function text(field: unknown) {
  const value = field as Field | undefined;
  if (!value || value.isNull) return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.longValue !== undefined) return String(value.longValue);
  if (value.doubleValue !== undefined) return String(value.doubleValue);
  if (value.booleanValue !== undefined) return String(value.booleanValue);
  return null;
}

function deterministicUuid(seed: string) {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function sourceRecord(sourceId: string) {
  const source = SOURCE_CATALOG.find((item) => item.id === sourceId);
  if (!source) throw new Error(`Missing source catalog record for ${sourceId}`);
  return source;
}

function hashFile(path: string) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function hpsaCoverageKey(discipline: string | null | undefined) {
  const normalized = (discipline ?? "").toLowerCase();
  if (normalized.includes("primary")) return "hpsa:primary_care";
  if (normalized.includes("dental")) return "hpsa:dental";
  if (normalized.includes("mental")) return "hpsa:mental_health";
  return null;
}

const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as NationalContextArtifact;
if (artifact.countyCount !== artifact.counties.length || artifact.counties.length !== 3_144) {
  throw new Error(`National context artifact must contain 3,144 counties; found ${artifact.counties.length}.`);
}

const duplicateCounty = artifact.counties.find((county, index) =>
  artifact.counties.findIndex((candidate) => candidate.fips === county.fips) !== index,
);
if (duplicateCounty) throw new Error(`Duplicate county ${duplicateCounty.fips} in national context artifact.`);

const requiredSources = ["census-acs5", "hrsa-workforce", "ahrf-workforce", "ahrq-clh"] as const;
for (const sourceId of requiredSources) {
  if (!artifact.sources[sourceId]) throw new Error(`National context artifact is missing source ${sourceId}.`);
}

const snapshot = await execute(
  `SELECT id::text, review_status::text, published_at::text
     FROM evidence.evidence_snapshot
    WHERE content_hash=:content_hash
    LIMIT 1`,
  [param("content_hash", SNAPSHOT_HASH)],
);
const snapshotRow = snapshot.records?.[0];
if (!snapshotRow) throw new Error(`Approved evidence snapshot ${SNAPSHOT_HASH} was not found.`);
const snapshotId = text(snapshotRow[0]);
const snapshotReview = text(snapshotRow[1]);
const snapshotPublishedAt = text(snapshotRow[2]);
if (!snapshotId || snapshotReview !== "verified" || !snapshotPublishedAt) {
  throw new Error("National context may only be loaded into a verified, published evidence snapshot.");
}

const geographyResult = await execute(
  `SELECT id::text, authority_id
     FROM evidence.geography
    WHERE authority='census' AND kind='county' AND review_status='verified'`,
);
const geographyByFips = new Map<string, string>();
for (const row of geographyResult.records ?? []) {
  const id = text(row[0]);
  const fips = text(row[1]);
  if (id && fips) geographyByFips.set(fips, id);
}
for (const county of artifact.counties) {
  if (!geographyByFips.has(county.fips)) throw new Error(`No verified county geography exists for ${county.fips}.`);
}

const sourceVersionById = new Map<string, string>();
for (const sourceId of requiredSources) {
  const src = artifact.sources[sourceId];
  if (src.reviewStatus !== "verified") {
    throw new Error(`National context source ${sourceId} must be verified before production loading.`);
  }
  sourceRecord(sourceId);
  const sourceVersionUuid = deterministicUuid(`source-version:${src.sourceVersionId}`);
  await execute(
    `INSERT INTO evidence.source_version (
       id, source_id, release_label, release_date, data_period_start, data_period_end,
       retrieved_at, stale_after, official_url, content_hash, schema_version,
       review_status, reviewed_by, reviewed_at
     ) VALUES (
       CAST(:id AS uuid), :source_id, :release_label, CAST(:release_date AS date),
       CAST(:data_period_start AS date), CAST(:data_period_end AS date),
       CAST(:retrieved_at AS timestamptz), CAST(:stale_after AS timestamptz),
       :official_url, :content_hash, :schema_version, 'verified',
       'national-context-loader', CAST(:reviewed_at AS timestamptz)
     )
     ON CONFLICT (source_id, release_label, content_hash) DO UPDATE SET
       release_label=EXCLUDED.release_label,
       release_date=EXCLUDED.release_date,
       data_period_start=EXCLUDED.data_period_start,
       data_period_end=EXCLUDED.data_period_end,
       retrieved_at=EXCLUDED.retrieved_at,
       stale_after=EXCLUDED.stale_after,
       official_url=EXCLUDED.official_url,
       schema_version=EXCLUDED.schema_version,
       review_status='verified', reviewed_by='national-context-loader', reviewed_at=EXCLUDED.reviewed_at`,
    [
      param("id", sourceVersionUuid),
      param("source_id", sourceId),
      param("release_label", src.releaseLabel),
      param("release_date", src.releaseDate),
      param("data_period_start", src.dataPeriodStart),
      param("data_period_end", src.dataPeriodEnd),
      param("retrieved_at", src.retrievedAt),
      param("stale_after", src.staleAfter),
      param("official_url", src.officialUrl),
      param("content_hash", src.contentHash),
      param("schema_version", src.schemaVersion),
      param("reviewed_at", artifact.generatedAt),
    ],
  );
  const resolved = await execute(
    `SELECT id::text FROM evidence.source_version
      WHERE source_id=:source_id AND release_label=:release_label AND content_hash=:content_hash LIMIT 1`,
    [
      param("source_id", sourceId),
      param("release_label", src.releaseLabel),
      param("content_hash", src.contentHash),
    ],
  );
  const resolvedId = text(resolved.records?.[0]?.[0]);
  if (!resolvedId) throw new Error(`Unable to resolve persisted source version for ${sourceId}.`);
  sourceVersionById.set(sourceId, resolvedId);

  await execute(
    `INSERT INTO evidence.snapshot_source_version (snapshot_id, source_version_id, required_for_snapshot)
     VALUES (CAST(:snapshot_id AS uuid), CAST(:source_version_id AS uuid), TRUE)
     ON CONFLICT DO NOTHING`,
    [param("snapshot_id", snapshotId), param("source_version_id", resolvedId)],
  );
}

const measureIdByKey = new Map<string, string>();
const measureTemplates = new Map<string, CountyMeasure>();
for (const county of artifact.counties) {
  for (const measure of [...county.acs, ...county.ahrf, ...county.ahrq]) {
    if (!measureTemplates.has(measure.id)) measureTemplates.set(measure.id, measure);
  }
}
const designationMeasure: CountyMeasure = {
  id: "measure:hrsa-workforce:hpsa-designation",
  sourceMeasureId: "HPSA_DESIGNATION",
  name: "Current HRSA shortage-area designation",
  description: "Official HPSA designation retained with source scope; not a countywide claim unless the source marks it as a whole-county geographic designation.",
  unit: "designation",
  universe: "HRSA Health Professional Shortage Area designations",
  adjustment: "not_applicable",
  direction: "contextual",
  higherValueMeaning: "context_dependent",
  comparisonPolicy: "context_only",
  value: null,
  numericValue: null,
};
const muaMeasure: CountyMeasure = {
  ...designationMeasure,
  id: "measure:hrsa-workforce:mua-p-designation",
  sourceMeasureId: "MUA_P_DESIGNATION",
  name: "Current HRSA medically underserved area or population designation",
  description: "Official MUA/P designation retained with source scope; not a whole-county claim unless the source marks it as such.",
};
measureTemplates.set(designationMeasure.id, designationMeasure);
measureTemplates.set(muaMeasure.id, muaMeasure);

for (const measure of measureTemplates.values()) {
  const id = deterministicUuid(`measure-definition:${measure.id}`);
  await execute(
    `INSERT INTO evidence.measure_definition (
       id, source_id, source_measure_id, name, description, unit, universe, adjustment,
       direction, higher_value_meaning, comparison_policy, review_status
     ) VALUES (
       CAST(:id AS uuid), :source_id, :source_measure_id, :name, :description, :unit, :universe, :adjustment,
       :direction, :higher_value_meaning, :comparison_policy, 'verified'
     )
     ON CONFLICT (source_id, source_measure_id) DO UPDATE SET
       name=EXCLUDED.name, description=EXCLUDED.description, unit=EXCLUDED.unit,
       universe=EXCLUDED.universe, adjustment=EXCLUDED.adjustment,
       direction=EXCLUDED.direction, higher_value_meaning=EXCLUDED.higher_value_meaning,
       comparison_policy=EXCLUDED.comparison_policy, review_status='verified'`,
    [
      param("id", id),
      param("source_id", measure.id.startsWith("measure:hrsa") ? "hrsa-workforce"
        : measure.id.startsWith("measure:ahrf") ? "ahrf-workforce"
          : measure.id.startsWith("measure:ahrq") ? "ahrq-clh" : "census-acs5"),
      param("source_measure_id", measure.sourceMeasureId),
      param("name", measure.name),
      param("description", measure.description),
      param("unit", measure.unit),
      param("universe", measure.universe),
      param("adjustment", measure.adjustment),
      param("direction", measure.direction),
      param("higher_value_meaning", measure.higherValueMeaning),
      param("comparison_policy", measure.comparisonPolicy),
    ],
  );
  const sourceId = measure.id.startsWith("measure:hrsa") ? "hrsa-workforce"
    : measure.id.startsWith("measure:ahrf") ? "ahrf-workforce"
      : measure.id.startsWith("measure:ahrq") ? "ahrq-clh" : "census-acs5";
  const resolved = await execute(
    `SELECT id::text FROM evidence.measure_definition
      WHERE source_id=:source_id AND source_measure_id=:source_measure_id
      LIMIT 1`,
    [param("source_id", sourceId), param("source_measure_id", measure.sourceMeasureId)],
  );
  const resolvedId = text(resolved.records?.[0]?.[0]);
  if (!resolvedId) throw new Error(`Unable to resolve measure definition ${measure.id}.`);
  measureIdByKey.set(measure.id, resolvedId);
}

async function insertObservation(
  county: CountyContext,
  sourceId: string,
  measure: CountyMeasure,
  index: number,
) {
  const geographyId = geographyByFips.get(county.fips)!;
  const sourceVersionId = sourceVersionById.get(sourceId)!;
  const measureDefinitionId = measureIdByKey.get(measure.id)!;
  const sourceRecordId = `${sourceId}:${county.fips}:${measure.sourceMeasureId}:${index}`;
  const id = deterministicUuid(`observation:${sourceVersionId}:${geographyId}:${measureDefinitionId}:${sourceRecordId}`);
  const src = artifact.sources[sourceId];
  const valueJson = JSON.stringify(measure.value);
  const metadata = JSON.stringify(measure.sourceMetadata ?? {});

  await enqueue(
    `INSERT INTO evidence.metric_observation (
       id, measure_definition_id, geography_id, source_version_id, source_record_id, source_url,
       geography_level, value_json, numeric_value, confidence_low, confidence_high, margin_of_error,
       release_date, data_period_start, data_period_end, retrieved_at, review_status, source_metadata
     ) VALUES (
       CAST(:id AS uuid), CAST(:measure_definition_id AS uuid), CAST(:geography_id AS uuid),
       CAST(:source_version_id AS uuid), :source_record_id, :source_url, :geography_level,
       CAST(:value_json AS jsonb), :numeric_value, :confidence_low, :confidence_high, :margin_of_error,
       CAST(:release_date AS date), CAST(:data_period_start AS date), CAST(:data_period_end AS date),
       CAST(:retrieved_at AS timestamptz), 'verified', CAST(:source_metadata AS jsonb)
     )
     ON CONFLICT (source_version_id, geography_id, measure_definition_id, source_record_id) DO UPDATE SET
       value_json=EXCLUDED.value_json, numeric_value=EXCLUDED.numeric_value,
       confidence_low=EXCLUDED.confidence_low, confidence_high=EXCLUDED.confidence_high,
       margin_of_error=EXCLUDED.margin_of_error, release_date=EXCLUDED.release_date,
       data_period_start=EXCLUDED.data_period_start, data_period_end=EXCLUDED.data_period_end,
       retrieved_at=EXCLUDED.retrieved_at, review_status='verified', source_metadata=EXCLUDED.source_metadata`,
    [
      param("id", id),
      param("measure_definition_id", measureDefinitionId),
      param("geography_id", geographyId),
      param("source_version_id", sourceVersionId),
      param("source_record_id", sourceRecordId),
      param("source_url", src.officialUrl),
      param("geography_level", measure.geographyLevel ?? "county"),
      param("value_json", valueJson),
      param("numeric_value", measure.numericValue),
      param("confidence_low", measure.confidenceLow ?? null),
      param("confidence_high", measure.confidenceHigh ?? null),
      param("margin_of_error", measure.marginOfError ?? null),
      param("release_date", src.releaseDate),
      param("data_period_start", measure.dataPeriodStart ?? src.dataPeriodStart),
      param("data_period_end", measure.dataPeriodEnd ?? src.dataPeriodEnd),
      param("retrieved_at", src.retrievedAt),
      param("source_metadata", metadata),
    ],
  );
}

async function insertDesignation(
  county: CountyContext,
  family: "hpsa" | "mua_p",
  designation: WorkforceDesignation,
) {
  const geographyId = geographyByFips.get(county.fips)!;
  const sourceVersionId = sourceVersionById.get("hrsa-workforce")!;
  const sourceRecordId = designation.designationId;
  const id = deterministicUuid(`workforce:${sourceVersionId}:${geographyId}:${family}:${sourceRecordId}`);
  const metadata = JSON.stringify(designation.sourceMetadata ?? {});
  const score = family === "hpsa" ? designation.score ?? null : designation.imuScore ?? null;

  await enqueue(
    `INSERT INTO evidence.workforce_designation (
       id, geography_id, source_version_id, source_record_id, designation_family,
       discipline, designation_name, designation_type, component_type, status, score,
       designation_date, last_update_date, whole_county, source_scope,
       source_metadata, review_status
     ) VALUES (
       CAST(:id AS uuid), CAST(:geography_id AS uuid), CAST(:source_version_id AS uuid), :source_record_id,
       :designation_family, :discipline, :designation_name, :designation_type, :component_type, :status,
       :score, CAST(:designation_date AS date), CAST(:last_update_date AS date), :whole_county, :source_scope,
       CAST(:source_metadata AS jsonb), 'verified'
     )
     ON CONFLICT (source_version_id, source_record_id, geography_id) DO UPDATE SET
       discipline=EXCLUDED.discipline, designation_name=EXCLUDED.designation_name,
       designation_type=EXCLUDED.designation_type, component_type=EXCLUDED.component_type,
       status=EXCLUDED.status, score=EXCLUDED.score, designation_date=EXCLUDED.designation_date,
       last_update_date=EXCLUDED.last_update_date, whole_county=EXCLUDED.whole_county,
       source_scope=EXCLUDED.source_scope, source_metadata=EXCLUDED.source_metadata,
       review_status='verified'`,
    [
      param("id", id),
      param("geography_id", geographyId),
      param("source_version_id", sourceVersionId),
      param("source_record_id", sourceRecordId),
      param("designation_family", family),
      param("discipline", designation.discipline ?? "not_applicable"),
      param("designation_name", designation.designationName),
      param("designation_type", designation.designationType),
      param("component_type", designation.componentType),
      param("status", designation.status),
      param("score", score),
      param("designation_date", designation.designationDate ?? null),
      param("last_update_date", designation.lastUpdateDate ?? null),
      param("whole_county", Boolean(designation.wholeCounty)),
      param("source_scope", designation.sourceScope ?? "other"),
      param("source_metadata", metadata),
    ],
  );
}

for (const county of artifact.counties) {
  for (let index = 0; index < county.acs.length; index += 1) {
    await insertObservation(county, "census-acs5", county.acs[index], index);
  }
  for (let index = 0; index < county.ahrf.length; index += 1) {
    await insertObservation(county, "ahrf-workforce", county.ahrf[index], index);
  }
  for (let index = 0; index < county.ahrq.length; index += 1) {
    await insertObservation(county, "ahrq-clh", county.ahrq[index], index);
  }
  for (const designation of county.hpsa) await insertDesignation(county, "hpsa", designation);
  for (const designation of county.muaP) await insertDesignation(county, "mua_p", designation);

  const geographyId = geographyByFips.get(county.fips)!;
  const hpsaByKey = new Map<string, number>([
    ["hpsa:primary_care", 0],
    ["hpsa:dental", 0],
    ["hpsa:mental_health", 0],
  ]);
  for (const designation of county.hpsa) {
    const key = hpsaCoverageKey(designation.discipline);
    if (key) hpsaByKey.set(key, (hpsaByKey.get(key) ?? 0) + 1);
  }

  const coverageRecords = [
    {
      sourceId: "census-acs5",
      coverageKey: "source:all",
      sourceVersionId: sourceVersionById.get("census-acs5")!,
      count: county.acs.length,
      status: county.acs.length ? "available" : "unavailable_from_source",
      reason: county.acs.length ? "Verified ACS county context is available." : "No compatible ACS context record is available for this county.",
      dataPeriodStart: artifact.sources["census-acs5"].dataPeriodStart,
      dataPeriodEnd: artifact.sources["census-acs5"].dataPeriodEnd,
      reviewedAt: artifact.generatedAt,
      reviewStatus: "verified",
      metadata: { artifact: ARTIFACT_PATH },
    },
    {
      sourceId: "hrsa-workforce",
      coverageKey: "source:all",
      sourceVersionId: sourceVersionById.get("hrsa-workforce")!,
      count: county.hpsa.length + county.muaP.length,
      status: "available",
      reason: county.hpsa.length + county.muaP.length
        ? "Verified HRSA designation context was evaluated for this county."
        : "Verified HRSA source processing completed for this county and returned no HPSA or MUA/P designation records.",
      dataPeriodStart: artifact.sources["hrsa-workforce"].dataPeriodStart,
      dataPeriodEnd: artifact.sources["hrsa-workforce"].dataPeriodEnd,
      reviewedAt: artifact.generatedAt,
      reviewStatus: "verified",
      metadata: { artifact: ARTIFACT_PATH },
    },
    ...["hpsa:primary_care", "hpsa:dental", "hpsa:mental_health"].map((coverageKey) => {
      const count = hpsaByKey.get(coverageKey) ?? 0;
      return {
        sourceId: "hrsa-workforce",
        coverageKey,
        sourceVersionId: sourceVersionById.get("hrsa-workforce")!,
        count,
        status: "available",
        reason: count
          ? `Verified ${coverageKey} HPSA source processing returned ${count} record(s) for this county.`
          : `Verified ${coverageKey} HPSA source processing completed for this county and returned zero records.`,
        dataPeriodStart: artifact.sources["hrsa-workforce"].dataPeriodStart,
        dataPeriodEnd: artifact.sources["hrsa-workforce"].dataPeriodEnd,
        reviewedAt: artifact.generatedAt,
        reviewStatus: "verified",
        metadata: { artifact: ARTIFACT_PATH, normalizedGatewayCoverage: count ? "complete_with_records" : "complete_no_records" },
      };
    }),
    {
      sourceId: "hrsa-workforce",
      coverageKey: "mua_p:all",
      sourceVersionId: sourceVersionById.get("hrsa-workforce")!,
      count: county.muaP.length,
      status: "available",
      reason: county.muaP.length
        ? "Verified MUA/P source processing returned designation records for this county."
        : "Verified MUA/P source processing completed for this county and returned zero records.",
      dataPeriodStart: artifact.sources["hrsa-workforce"].dataPeriodStart,
      dataPeriodEnd: artifact.sources["hrsa-workforce"].dataPeriodEnd,
      reviewedAt: artifact.generatedAt,
      reviewStatus: "verified",
      metadata: { artifact: ARTIFACT_PATH, normalizedGatewayCoverage: county.muaP.length ? "complete_with_records" : "complete_no_records" },
    },
    {
      sourceId: "ahrf-workforce",
      coverageKey: "source:all",
      sourceVersionId: sourceVersionById.get("ahrf-workforce")!,
      count: county.ahrf.length,
      status: county.ahrf.length ? "available" : "unavailable_from_source",
      reason: county.ahrf.length ? "Verified AHRF county workforce context is available." : "No compatible AHRF county context record is available.",
      dataPeriodStart: artifact.sources["ahrf-workforce"].dataPeriodStart,
      dataPeriodEnd: artifact.sources["ahrf-workforce"].dataPeriodEnd,
      reviewedAt: artifact.generatedAt,
      reviewStatus: "verified",
      metadata: { artifact: ARTIFACT_PATH },
    },
    {
      sourceId: "ahrq-clh",
      coverageKey: "source:all",
      sourceVersionId: sourceVersionById.get("ahrq-clh")!,
      count: county.ahrq.length,
      status: county.ahrq.length ? "available" : "unavailable_from_source",
      reason: county.ahrq.length ? "Verified AHRQ community context is available." : "No compatible AHRQ county context record is available.",
      dataPeriodStart: artifact.sources["ahrq-clh"].dataPeriodStart,
      dataPeriodEnd: artifact.sources["ahrq-clh"].dataPeriodEnd,
      reviewedAt: artifact.generatedAt,
      reviewStatus: "verified",
      metadata: { artifact: ARTIFACT_PATH },
    },
  ];

  for (const coverage of coverageRecords) {
    await enqueue(
      `INSERT INTO evidence.source_coverage (
         snapshot_id, geography_id, source_id, coverage_key, status, reason, source_version_id,
         data_period_start, data_period_end, observed_at, observation_count, review_status, metadata
       ) VALUES (
         CAST(:snapshot_id AS uuid), CAST(:geography_id AS uuid), :source_id, :coverage_key,
         CAST(:status AS evidence.source_coverage_status), :reason, CAST(:source_version_id AS uuid),
         CAST(:data_period_start AS date), CAST(:data_period_end AS date), CAST(:observed_at AS timestamptz),
         :observation_count, CAST(:review_status AS evidence.review_status), CAST(:metadata AS jsonb)
       )
       ON CONFLICT (snapshot_id, geography_id, source_id, coverage_key) DO UPDATE SET
         status=EXCLUDED.status, reason=EXCLUDED.reason, source_version_id=EXCLUDED.source_version_id,
         data_period_start=EXCLUDED.data_period_start, data_period_end=EXCLUDED.data_period_end,
         observed_at=EXCLUDED.observed_at, observation_count=EXCLUDED.observation_count,
         review_status=EXCLUDED.review_status, metadata=EXCLUDED.metadata`,
      [
        param("snapshot_id", snapshotId),
        param("geography_id", geographyId),
        param("source_id", coverage.sourceId),
        param("coverage_key", coverage.coverageKey),
        param("status", coverage.status),
        param("reason", coverage.reason),
        param("source_version_id", coverage.sourceVersionId),
        param("data_period_start", coverage.dataPeriodStart),
        param("data_period_end", coverage.dataPeriodEnd),
        param("observed_at", coverage.reviewedAt),
        param("observation_count", coverage.count),
        param("review_status", coverage.reviewStatus),
        param("metadata", JSON.stringify(coverage.metadata)),
      ],
    );
  }
}

await flushAllBatches();

console.log(JSON.stringify({
  loaded: true,
  artifactPath: ARTIFACT_PATH,
  artifactHash: hashFile(ARTIFACT_PATH),
  snapshotHash: SNAPSHOT_HASH,
  countyCount: artifact.counties.length,
  sourceVersions: Object.fromEntries(sourceVersionById),
  runId: randomUUID(),
}, null, 2));
