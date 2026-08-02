import {
  buildCountyPlaceBrief,
  recomputeEvidenceAssessment,
  type CountyEvidenceSnapshotRecord,
  type ExploreCitation,
  type ExplorePlaceBriefV1,
  type ExploreSourceCoverage,
  type CountyEvidenceSnapshot,
} from "@sozorock/evidence-core";
import {
  evidenceFieldValue,
  evidenceRuntimeEnvironment,
  executeEvidenceSql,
} from "./evidence-runtime-authority";

const STATE_CODES: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
  "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY",
};

const MEASURE_GROUPS: Record<string, { group: "conditions" | "barriers" | "prevention"; field: string }> = {
  BPHIGH: { group: "conditions", field: "highBloodPressure" },
  DIABETES: { group: "conditions", field: "diabetes" },
  CHD: { group: "conditions", field: "coronaryHeartDisease" },
  STROKE: { group: "conditions", field: "stroke" },
  CANCER: { group: "conditions", field: "cancer" },
  CASTHMA: { group: "conditions", field: "asthma" },
  COPD: { group: "conditions", field: "copd" },
  DEPRESSION: { group: "conditions", field: "depression" },
  OBESITY: { group: "conditions", field: "obesity" },
  ACCESS2: { group: "barriers", field: "uninsured" },
  LACKTRPT: { group: "barriers", field: "transportation" },
  FOODINSECU: { group: "barriers", field: "foodInsecurity" },
  HOUSINSECU: { group: "barriers", field: "housingInsecurity" },
  SHUTUTILITY: { group: "barriers", field: "utilityShutoff" },
  LONELINESS: { group: "barriers", field: "loneliness" },
  DISABILITY: { group: "barriers", field: "disability" },
  CHECKUP: { group: "prevention", field: "annualCheckup" },
  DENTAL: { group: "prevention", field: "dentalVisit" },
  CHOLSCREEN: { group: "prevention", field: "cholesterolScreening" },
  COLON_SCREEN: { group: "prevention", field: "colorectalScreening" },
  MAMMOUSE: { group: "prevention", field: "mammography" },
};

type Row = unknown[];

// The content hash is part of the cache key.  A county record must never be
// reused across evidence snapshots during a rollback or pin change.
const runtimeRecordCache = new Map<string, CountyEvidenceSnapshotRecord>();

const OPTIONAL_SOURCE_META: Record<string, {
  publisher: string;
  title: string;
}> = {
  "census-acs5": {
    publisher: "U.S. Census Bureau",
    title: "American Community Survey five-year estimates",
  },
  "hrsa-workforce": {
    publisher: "Health Resources and Services Administration",
    title: "Health Professional Shortage Areas and Medically Underserved Areas and Populations",
  },
  "ahrf-workforce": {
    publisher: "Health Resources and Services Administration, Bureau of Health Workforce",
    title: "Area Health Resources Files",
  },
  "ahrq-clh": {
    publisher: "Agency for Healthcare Research and Quality",
    title: "Community-Level Health Database",
  },
};

export type PublishedWorkforceContext = {
  hpsa: Array<{
    designationId: string;
    designationName: string;
    designationType: string;
    componentType: string;
    discipline: string;
    status: string;
    score: number | null;
    designationDate: string | null;
    lastUpdateDate: string | null;
    wholeCounty: boolean;
    sourceVersionId?: string;
    sourceId?: string;
    releaseDate?: string | null;
    dataPeriod?: { start: string | null; end: string | null };
    retrievedAt?: string | null;
    officialUrl?: string;
  }>;
  muaP: Array<{
    designationId: string;
    designationName: string;
    designationType: string;
    componentType: string;
    populationType: string;
    status: string;
    imuScore: number | null;
    designationDate: string | null;
    lastUpdateDate: string | null;
    wholeCounty: boolean;
    sourceVersionId?: string;
    sourceId?: string;
    releaseDate?: string | null;
    dataPeriod?: { start: string | null; end: string | null };
    retrievedAt?: string | null;
    officialUrl?: string;
  }>;
};

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

function jsonValue(value: unknown): number | string | boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return value as number | string | boolean;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed === null || typeof parsed === "number" || typeof parsed === "string" || typeof parsed === "boolean"
      ? parsed
      : value;
  } catch {
    return value;
  }
}

function sourceProvenance(value: unknown, columns?: {
  sourceVariableId?: unknown;
  numeratorVariableId?: unknown;
  denominatorVariableId?: unknown;
  formula?: unknown;
  transformationVersion?: unknown;
  table?: unknown;
  group?: unknown;
  estimateField?: unknown;
  marginOfErrorField?: unknown;
}) {
  let metadata: Record<string, unknown> = {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
    } catch { /* malformed optional metadata remains incomplete */ }
  }
  const pick = (column: unknown, ...keys: string[]) => {
    if (column !== undefined && column !== null && column !== "") return String(column);
    const candidate = keys.map((key) => metadata[key]).find((item) => item !== undefined && item !== null && item !== "");
    return candidate === undefined ? null : String(candidate);
  };
  const sourceVariableId = pick(columns?.sourceVariableId, "variableId", "sourceVariableId");
  return {
    sourceVariableId,
    numeratorVariableId: pick(columns?.numeratorVariableId, "numeratorVariableId"),
    denominatorVariableId: pick(columns?.denominatorVariableId, "denominatorVariableId"),
    formula: pick(columns?.formula, "formula"),
    transformationVersion: pick(columns?.transformationVersion, "transformationVersion"),
    table: pick(columns?.table, "table"),
    group: pick(columns?.group, "group"),
    estimateField: pick(columns?.estimateField, "estimateField") ?? sourceVariableId,
    marginOfErrorField: pick(columns?.marginOfErrorField, "marginOfErrorVariableId", "marginOfErrorField"),
  };
}

const ACS_VARIABLE_ID = /^[A-Z][0-9]{5}_[0-9]{3}[A-Z]$/;

function normalizeAcsProvenance(provenance: ReturnType<typeof sourceProvenance>) {
  const sourceVariableId = provenance.sourceVariableId && ACS_VARIABLE_ID.test(provenance.sourceVariableId)
    ? provenance.sourceVariableId
    : null;
  const numeratorVariableId = provenance.numeratorVariableId && ACS_VARIABLE_ID.test(provenance.numeratorVariableId)
    ? provenance.numeratorVariableId
    : null;
  const denominatorVariableId = provenance.denominatorVariableId && ACS_VARIABLE_ID.test(provenance.denominatorVariableId)
    ? provenance.denominatorVariableId
    : null;
  const estimateField = provenance.estimateField && ACS_VARIABLE_ID.test(provenance.estimateField)
    ? provenance.estimateField
    : null;
  const marginOfErrorField = provenance.marginOfErrorField && ACS_VARIABLE_ID.test(provenance.marginOfErrorField)
    ? provenance.marginOfErrorField
    : null;
  const complete = Boolean(
    (sourceVariableId || (numeratorVariableId && denominatorVariableId))
    && estimateField
    && provenance.table
    && provenance.group,
  );
  return {
    provenance: {
      ...provenance,
      sourceVariableId,
      numeratorVariableId,
      denominatorVariableId,
      estimateField,
      marginOfErrorField,
    },
    complete,
  };
}

function dateValue(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function citationId(observationId: string) {
  return `runtime-citation:${observationId}`;
}

function countyRecordFromBrief(
  geoid: string,
  brief: ExplorePlaceBriefV1,
  seed?: CountyEvidenceSnapshotRecord,
): CountyEvidenceSnapshotRecord {
  const selected = brief.resolution.selected;
  const displayName = selected?.displayName ?? geoid;
  const [countyName] = displayName.split(",");
  const stateFips = geoid.slice(0, 2);
  const record: CountyEvidenceSnapshotRecord = {
    fips: geoid,
    stateFips: seed?.stateFips ?? stateFips,
    countyFips: seed?.countyFips ?? geoid.slice(2),
    state: seed?.state ?? "",
    stateCode: seed?.stateCode ?? STATE_CODES[stateFips] ?? stateFips,
    county: seed?.county ?? countyName ?? geoid,
    centroid: seed?.centroid ?? { lat: 0, lon: 0 },
    landSquareMiles: seed?.landSquareMiles ?? 0,
    population: seed?.population ?? null,
    adultPopulation: seed?.adultPopulation ?? null,
    conditions: {},
    barriers: {},
    prevention: {},
    dataCoverage: 0,
    sourceStatus: "unavailable",
  };
  const cdcSourceIds = new Set(
    brief.publicData.sources
      .filter((source) => source.sourceId === "cdc-places")
      .map((source) => source.sourceVersionId),
  );
  for (const observation of brief.publicData.observations) {
    if (!cdcSourceIds.has(observation.sourceVersionId) || typeof observation.value !== "number") continue;
    const citation = brief.citations.find((item) => item.id === observation.citationIds[0]);
    const canonicalMeasureId = citation?.sourceField?.replace(/:Crude$/i, "") ?? "";
    const mapping = MEASURE_GROUPS[canonicalMeasureId];
    if (!mapping) continue;
    const low = observation.confidence.low;
    const high = observation.confidence.high;
    record[mapping.group][mapping.field] = {
      value: observation.value,
      ci: low !== null && high !== null ? [low, high] : null,
    };
  }
  const cdcObservationCount = brief.publicData.observations.filter((observation) =>
    cdcSourceIds.has(observation.sourceVersionId),
  ).length;
  record.dataCoverage = cdcObservationCount;
  record.sourceStatus = cdcObservationCount ? "available" : "unavailable";
  return record;
}

function runtimeSnapshotHash(expectedHash?: string) {
  const hash = (expectedHash ?? process.env.EVIDENCE_SNAPSHOT_CONTENT_HASH ?? "").trim();
  return /^sha256:[0-9a-fA-F]{64}$/.test(hash) ? hash : null;
}

async function loadPublishedBriefFromEvidenceCore(geoid: string, expectedHash: string): Promise<ExplorePlaceBriefV1 | null> {
  const snapshotResult = await executeEvidenceSql(
    `SELECT s.id::text, s.content_hash, s.policy_version, s.created_at::text,
            sv.id::text, sv.release_date::text, sv.data_period_start::text,
            sv.data_period_end::text, sv.retrieved_at::text, sv.official_url
       FROM evidence.evidence_snapshot s
       JOIN evidence.snapshot_source_version link ON link.snapshot_id=s.id
       JOIN evidence.source_version sv ON sv.id=link.source_version_id
      WHERE s.content_hash=:content_hash
        AND s.review_status='verified' AND s.published_at IS NOT NULL
        AND sv.source_id='cdc-places' AND sv.review_status='verified'
      LIMIT 1`,
    [{ name: "content_hash", value: { stringValue: expectedHash } }],
  );
  const snapshotRow = snapshotResult.records?.[0];
  if (!snapshotRow) return null;
  const snapshotUuid = text(field(snapshotRow, 0));
  const contentHash = text(field(snapshotRow, 1));
  const snapshotId = contentHash.replace(/^sha256:/, "snapshot:");
  const policyVersion = text(field(snapshotRow, 2), "place-evidence-policy.v1");
  const generatedAt = text(field(snapshotRow, 3), new Date().toISOString());
  const cdcSourceVersionId = text(field(snapshotRow, 4));
  const cdcReleaseDate = text(field(snapshotRow, 5));
  const cdcPeriodStart = text(field(snapshotRow, 6), "");
  const cdcPeriodEnd = text(field(snapshotRow, 7), "");
  const cdcRetrievedAt = text(field(snapshotRow, 8), generatedAt);
  const cdcOfficialUrl = text(field(snapshotRow, 9), "https://data.cdc.gov/500-Cities-Places/PLACES-County-Data-GIS-Friendly-Format-2025-releas/i46a-9kgh");

  const sourceVersionResult = await executeEvidenceSql(
    `SELECT sv.id::text, sv.source_id, sv.release_date::text,
            sv.data_period_start::text, sv.data_period_end::text,
            sv.retrieved_at::text, sv.official_url, sv.review_status::text
       FROM evidence.snapshot_source_version link
       JOIN evidence.source_version sv ON sv.id=link.source_version_id
      WHERE link.snapshot_id=CAST(:snapshot_id AS uuid)`,
    [{ name: "snapshot_id", value: { stringValue: snapshotUuid } }],
  );
  const sourceVersions = (sourceVersionResult.records ?? []).map((row) => ({
    id: text(field(row, 0)),
    sourceId: text(field(row, 1)),
    releaseDate: text(field(row, 2)),
    periodStart: dateValue(field(row, 3)),
    periodEnd: dateValue(field(row, 4)),
    retrievedAt: text(field(row, 5), generatedAt),
    officialUrl: text(field(row, 6)),
    reviewStatus: text(field(row, 7), "verified"),
  }));
  // A published snapshot is usable only when every linked source version is
  // reviewed and at least one source version is present.  This prevents a
  // partially published or rollback-incomplete snapshot from being served.
  if (!sourceVersions.length || sourceVersions.some((source) => source.reviewStatus !== "verified")) return null;
  const selectedCdcSource = sourceVersions.find((source) => source.id === cdcSourceVersionId && source.sourceId === "cdc-places");
  if (!selectedCdcSource) return null;
  const censusGeographySource = sourceVersions.find((source) => source.sourceId === "census-geography");
  const snapshotVintage = censusGeographySource?.releaseDate?.slice(0, 4) || null;
  if (!snapshotVintage) return null;
  const sourceVersionById = new Map(sourceVersions.map((source) => [source.id, source]));

  const geographyResult = await executeEvidenceSql(
    `SELECT id::text, name, display_name, state_fips, county_fips, vintage,
            ST_Y(point_on_surface)::double precision,
            ST_X(point_on_surface)::double precision
       FROM evidence.geography
      WHERE authority='census' AND kind='county' AND authority_id=:geoid
        AND review_status='verified'
        AND vintage=:vintage
      ORDER BY vintage DESC
      LIMIT 1`,
    [
      { name: "geoid", value: { stringValue: geoid } },
      { name: "vintage", value: { stringValue: snapshotVintage } },
    ],
  );
  const geographyRow = geographyResult.records?.[0];
  if (!geographyRow) return null;
  const geographyId = text(field(geographyRow, 0));
  const stateFips = text(field(geographyRow, 3));
  const countyFips = text(field(geographyRow, 4));
  const vintage = text(field(geographyRow, 5), "2025");
  const record: CountyEvidenceSnapshotRecord = {
    fips: geoid,
    stateFips,
    countyFips,
    state: "",
    stateCode: STATE_CODES[stateFips] ?? stateFips,
    county: text(field(geographyRow, 1), text(field(geographyRow, 2), geoid)),
    centroid: { lat: numberValue(field(geographyRow, 6)) ?? 0, lon: numberValue(field(geographyRow, 7)) ?? 0 },
    landSquareMiles: 0,
    population: null,
    adultPopulation: null,
    conditions: {},
    barriers: {},
    prevention: {},
    dataCoverage: 0,
    sourceStatus: "unavailable",
  };

  const observationResult = await executeEvidenceSql(
    `SELECT o.id::text, o.measure_definition_id::text, d.source_measure_id,
            d.name, d.direction::text, d.unit, d.universe, d.adjustment,
            o.numeric_value, o.confidence_low, o.confidence_high, o.margin_of_error,
            o.release_date::text, o.data_period_start::text, o.data_period_end::text,
            o.retrieved_at::text, o.review_status::text, o.source_record_id,
            o.source_url, o.source_metadata::text,
            o.source_variable_id, o.source_numerator_variable_id,
            o.source_denominator_variable_id, o.source_formula,
            o.source_transformation_version, o.source_table, o.source_group,
            o.source_estimate_field, o.source_margin_of_error_field
       FROM evidence.metric_observation o
       JOIN evidence.measure_definition d ON d.id=o.measure_definition_id
      WHERE o.geography_id=CAST(:geography_id AS uuid)
        AND o.source_version_id=CAST(:source_version_id AS uuid)
        AND o.review_status='verified'
      ORDER BY d.source_measure_id`,
    [
      { name: "geography_id", value: { stringValue: geographyId } },
      { name: "source_version_id", value: { stringValue: cdcSourceVersionId } },
    ],
  );
  const observations: ExplorePlaceBriefV1["publicData"]["observations"] = [];
  const citations: ExploreCitation[] = [];
  for (const row of observationResult.records ?? []) {
    const sourceMeasureId = text(field(row, 2)).replace(/:Crude$/i, "");
    const mapping = MEASURE_GROUPS[sourceMeasureId];
    if (!mapping) continue;
    const value = numberValue(field(row, 8));
    const low = numberValue(field(row, 9));
    const high = numberValue(field(row, 10));
    const marginOfError = numberValue(field(row, 11));
    const id = text(field(row, 0));
    const cite = citationId(id);
    const direction = text(field(row, 4), "unknown") as "adverse" | "protective" | "contextual" | "unknown";
    const observation = {
      id,
      measureDefinitionId: text(field(row, 1)),
      label: text(field(row, 3), sourceMeasureId),
      direction,
      unit: text(field(row, 5), "percent"),
      universe: text(field(row, 6), "See the official source definition for the eligible population."),
      adjustment: text(field(row, 7), "modeled"),
      value,
      confidence: { low, high, marginOfError },
      geographyId,
      sourceVersionId: cdcSourceVersionId,
      releaseDate: text(field(row, 12), cdcReleaseDate),
      dataPeriod: { start: dateValue(field(row, 13)), end: dateValue(field(row, 14)) },
      reviewStatus: "verified" as const,
      interpretation: direction === "contextual" || direction === "unknown" ? "context_only" as const : "not_rankable" as const,
      benchmarkObservationId: null,
      citationIds: [cite],
    };
    observations.push(observation);
    citations.push({
      id: cite,
      sourceVersionId: cdcSourceVersionId,
      documentId: null,
      officialUrl: text(field(row, 18), cdcOfficialUrl),
      pageNumber: null,
      section: null,
      sourceField: text(field(row, 2), sourceMeasureId),
      quotedText: null,
      reviewStatus: "verified",
      sourceProvenance: sourceProvenance(field(row, 19), {
        sourceVariableId: field(row, 20), numeratorVariableId: field(row, 21),
        denominatorVariableId: field(row, 22), formula: field(row, 23),
        transformationVersion: field(row, 24), table: field(row, 25),
        group: field(row, 26), estimateField: field(row, 27),
        marginOfErrorField: field(row, 28),
      }),
    });
    const metric = value === null ? undefined : { value, ci: low !== null && high !== null ? [low, high] as [number, number] : null };
    if (metric) record[mapping.group][mapping.field] = metric;
  }

  const cdcObservationCount = observations.length;

  // Context sources are loaded into the same approved snapshot as CDC PLACES.
  // Keep their original source version, period, universe and uncertainty; never
  // reinterpret them as CDC measures or as a different geography.
  const contextSourceIds = sourceVersions
    .filter((source) => source.sourceId !== "cdc-places" && source.sourceId !== "census-geography")
    .map((source) => source.id);
  if (contextSourceIds.length > 0) {
    const contextParameters = [
      { name: "geography_id", value: { stringValue: geographyId } },
      ...contextSourceIds.map((id, index) => ({ name: `context_source_${index}`, value: { stringValue: id } })),
    ];
    const contextResult = await executeEvidenceSql(
      `SELECT o.id::text, o.measure_definition_id::text, d.source_measure_id,
              d.name, d.direction::text, d.unit, d.universe, d.adjustment,
              o.numeric_value, o.value_json::text, o.confidence_low, o.confidence_high,
              o.margin_of_error, o.release_date::text, o.data_period_start::text,
              o.data_period_end::text, o.retrieved_at::text, o.review_status::text,
              o.source_record_id, o.source_url, sv.id::text, sv.source_id,
              sv.official_url, sv.release_date::text, sv.data_period_start::text,
              sv.data_period_end::text, sv.retrieved_at::text,
              o.source_metadata::text, o.source_variable_id,
              o.source_numerator_variable_id, o.source_denominator_variable_id,
              o.source_formula, o.source_transformation_version, o.source_table,
              o.source_group, o.source_estimate_field, o.source_margin_of_error_field
         FROM evidence.metric_observation o
         JOIN evidence.measure_definition d ON d.id=o.measure_definition_id
         JOIN evidence.source_version sv ON sv.id=o.source_version_id
        WHERE o.geography_id=CAST(:geography_id AS uuid)
          AND o.source_version_id IN (${contextSourceIds.map((_, index) => `CAST(:context_source_${index} AS uuid)`).join(", ")})
          AND o.review_status='verified'
        ORDER BY sv.source_id, d.source_measure_id`,
      contextParameters,
    );
    for (const row of contextResult.records ?? []) {
      const id = text(field(row, 0));
      const sourceVersionId = text(field(row, 20));
      const sourceId = text(field(row, 21));
      const sourceVersion = sourceVersionById.get(sourceVersionId);
      const cite = citationId(id);
      const direction = text(field(row, 4), "unknown") as "adverse" | "protective" | "contextual" | "unknown";
      observations.push({
        id,
        measureDefinitionId: text(field(row, 1)),
        label: text(field(row, 3), text(field(row, 2), sourceId)),
        direction,
        unit: text(field(row, 5), "context"),
        universe: text(field(row, 6), "See the official source definition for the eligible population."),
        adjustment: text(field(row, 7), "not_applicable"),
        value: numberValue(field(row, 8)) ?? jsonValue(field(row, 9)),
        confidence: {
          low: numberValue(field(row, 10)),
          high: numberValue(field(row, 11)),
          marginOfError: numberValue(field(row, 12)),
        },
        geographyId,
        sourceVersionId,
        releaseDate: text(field(row, 13), sourceVersion?.releaseDate ?? ""),
        dataPeriod: { start: dateValue(field(row, 14)), end: dateValue(field(row, 15)) },
        reviewStatus: "verified",
        interpretation: direction === "contextual" || direction === "unknown" ? "context_only" : "not_rankable",
        benchmarkObservationId: null,
        citationIds: [cite],
      });
      const metadata = sourceVersion ?? {
        releaseDate: text(field(row, 23)),
        periodStart: dateValue(field(row, 24)),
        periodEnd: dateValue(field(row, 25)),
        retrievedAt: text(field(row, 26), generatedAt),
        officialUrl: text(field(row, 22)),
      };
      const rawContextProvenance = sourceProvenance(field(row, 27), {
        sourceVariableId: field(row, 28), numeratorVariableId: field(row, 29),
        denominatorVariableId: field(row, 30), formula: field(row, 31),
        transformationVersion: field(row, 32), table: field(row, 33),
        group: field(row, 34), estimateField: field(row, 35),
        marginOfErrorField: field(row, 36),
      });
      const contextAcsProvenance = sourceId === "census-acs5"
        ? normalizeAcsProvenance(rawContextProvenance)
        : { provenance: rawContextProvenance, complete: true };
      const contextProvenance = contextAcsProvenance.provenance;
      const contextSourceField = sourceId === "census-acs5"
        ? contextProvenance.sourceVariableId
          ?? (contextProvenance.numeratorVariableId && contextProvenance.denominatorVariableId
            ? `${contextProvenance.numeratorVariableId} / ${contextProvenance.denominatorVariableId}`
            : null)
        : (field(row, 2) === null ? null : text(field(row, 2), text(field(row, 3))));
      citations.push({
        id: cite,
        sourceVersionId,
        documentId: null,
        officialUrl: text(field(row, 19), metadata.officialUrl),
        pageNumber: null,
        section: null,
        sourceField: contextSourceField,
        quotedText: null,
        reviewStatus: "verified",
        provenanceStatus: contextAcsProvenance.complete ? "complete" : "incomplete",
        sourceProvenance: contextProvenance,
      });
    }
  }
  record.dataCoverage = Object.keys(MEASURE_GROUPS).length ? Math.round((cdcObservationCount / Object.keys(MEASURE_GROUPS).length) * 100) : 0;
  record.sourceStatus = cdcObservationCount ? "available" : "unavailable";
  const snapshot: CountyEvidenceSnapshot = {
    schemaVersion: "sozorock.county-evidence-snapshot.v1",
    snapshotId,
    generatedAt,
    policyVersion,
    censusVintage: vintage,
    cdc: {
      datasetId: "cdc-places",
      officialUrl: cdcOfficialUrl,
      releaseDate: cdcReleaseDate,
      dataPeriodStart: cdcPeriodStart,
      dataPeriodEnd: cdcPeriodEnd,
      retrievedAt: cdcRetrievedAt,
    },
    counties: [record],
  };
  const brief = buildCountyPlaceBrief(record, snapshot, geoid);
  brief.publicData.observations = observations;
  brief.citations = citations;
  const publishedSources = sourceVersions
    .filter((source) => source.sourceId !== "census-geography")
    .map((source) => {
      const meta = OPTIONAL_SOURCE_META[source.sourceId] ?? {
        publisher: "Published evidence source",
        title: source.sourceId,
      };
      return {
        sourceId: source.sourceId,
        sourceVersionId: source.id,
        publisher: source.sourceId === "cdc-places" ? "Centers for Disease Control and Prevention" : meta.publisher,
        title: source.sourceId === "cdc-places" ? "PLACES: Local Data for Better Health" : meta.title,
        officialUrl: source.officialUrl || (source.sourceId === "cdc-places" ? cdcOfficialUrl : ""),
        releaseDate: source.releaseDate,
        dataPeriod: { start: source.periodStart, end: source.periodEnd },
        retrievedAt: source.retrievedAt,
        reviewStatus: "verified" as const,
      };
    });
  brief.publicData.sources = publishedSources.length ? publishedSources : observations.length ? [{
    sourceId: "cdc-places",
    sourceVersionId: cdcSourceVersionId,
    publisher: "Centers for Disease Control and Prevention",
    title: "PLACES: Local Data for Better Health",
    officialUrl: cdcOfficialUrl,
    releaseDate: cdcReleaseDate,
    dataPeriod: { start: cdcPeriodStart || null, end: cdcPeriodEnd || null },
    retrievedAt: cdcRetrievedAt,
    reviewStatus: "verified",
  }] : [];
  brief.resolution.selected = {
    ...brief.resolution.selected!,
    id: geographyId,
    authorityId: geoid,
    displayName: text(field(geographyRow, 2), `${record.county}, ${record.stateCode}`),
    vintage,
  };
  brief.resolution.evidenceGeographies = [brief.resolution.selected];

  const coverageResult = await executeEvidenceSql(
    `SELECT coverage.source_id, coverage.status::text, coverage.reason,
            coverage.source_version_id::text, version.release_date::text,
            coverage.data_period_start::text, coverage.data_period_end::text,
            coverage.observed_at::text, coverage.observation_count
       FROM evidence.source_coverage coverage
       LEFT JOIN evidence.source_version version ON version.id=coverage.source_version_id
      WHERE coverage.snapshot_id=CAST(:snapshot_id AS uuid)
        AND coverage.geography_id=CAST(:geography_id AS uuid)
      ORDER BY coverage.source_id`,
    [
      { name: "snapshot_id", value: { stringValue: snapshotUuid } },
      { name: "geography_id", value: { stringValue: geographyId } },
    ],
  );
  const coverage = (coverageResult.records ?? []).map((row): ExploreSourceCoverage => ({
    sourceId: text(field(row, 0)) as ExploreSourceCoverage["sourceId"],
    status: text(field(row, 1), "unavailable_from_source") as ExploreSourceCoverage["status"],
    reason: text(field(row, 2), "No source coverage explanation was recorded."),
    sourceVersionId: field(row, 3) === null ? null : text(field(row, 3)),
    geographyKind: text(field(row, 0)) === "hrsa-workforce" ? "source_designation" : "county",
    observationCount: Number(field(row, 8) ?? 0),
    releaseDate: dateValue(field(row, 4)),
    dataPeriod: { start: dateValue(field(row, 5)), end: dateValue(field(row, 6)) },
    retrievedAt: dateValue(field(row, 7)),
  }));
  if (coverage.length) brief.publicData.sourceCoverage = coverage;
  brief.evidenceAssessment = recomputeEvidenceAssessment(brief);
  // Only cache the record after the final persisted observations, sources and
  // coverage have been applied and the assessment has been recomputed.
  runtimeRecordCache.set(`${geoid}:${contentHash}`, countyRecordFromBrief(geoid, brief, record));
  return brief;
}

export async function getPublishedWorkforceContext(geoid: string, expectedHash?: string): Promise<PublishedWorkforceContext> {
  if (evidenceRuntimeEnvironment() === "test") {
    const fixture = await import("./approved-evidence-snapshot");
    return fixture.getHrsaCountyContext(geoid);
  }
  const snapshotHash = runtimeSnapshotHash(expectedHash);
  if (!snapshotHash) return { hpsa: [], muaP: [] };
  const result = await executeEvidenceSql(
    `SELECT d.source_record_id, d.designation_family, d.discipline,
            d.designation_name, d.designation_type, d.component_type, d.status,
            d.score, d.designation_date::text, d.last_update_date::text,
            d.whole_county, d.source_scope, d.source_metadata::text,
            COALESCE(d.source_metadata->>'populationType', d.source_metadata->>'population_type', d.designation_type),
            d.source_version_id::text, sv.source_id, sv.release_date::text,
            sv.data_period_start::text, sv.data_period_end::text,
            sv.retrieved_at::text, sv.official_url
       FROM evidence.workforce_designation d
       JOIN evidence.geography g ON g.id=d.geography_id
       JOIN evidence.snapshot_source_version link ON link.source_version_id=d.source_version_id
       JOIN evidence.evidence_snapshot snapshot ON snapshot.id=link.snapshot_id
       JOIN evidence.source_version sv ON sv.id=d.source_version_id
      WHERE snapshot.content_hash=:snapshot_hash
        AND snapshot.review_status='verified' AND snapshot.published_at IS NOT NULL
        AND sv.review_status='verified' AND sv.source_id='hrsa-workforce'
        AND link.snapshot_id=snapshot.id
        AND g.authority='census' AND g.kind='county' AND g.authority_id=:geoid
        AND d.review_status='verified'
      ORDER BY d.designation_family, d.source_record_id`,
    [
      { name: "geoid", value: { stringValue: geoid } },
      { name: "snapshot_hash", value: { stringValue: snapshotHash } },
    ],
  );
  const context: PublishedWorkforceContext = { hpsa: [], muaP: [] };
  for (const row of result.records ?? []) {
    const family = text(field(row, 1));
    const item = {
      designationId: text(field(row, 0)),
      designationName: text(field(row, 3), "HRSA designation"),
      designationType: text(field(row, 4)),
      componentType: text(field(row, 5)),
      status: text(field(row, 6), "Unknown"),
      score: numberValue(field(row, 7)),
      designationDate: dateValue(field(row, 8)),
      lastUpdateDate: dateValue(field(row, 9)),
      wholeCounty: Boolean(field(row, 10)),
      sourceVersionId: text(field(row, 14)),
      sourceId: text(field(row, 15), "hrsa-workforce"),
      releaseDate: dateValue(field(row, 16)),
      dataPeriod: { start: dateValue(field(row, 17)), end: dateValue(field(row, 18)) },
      retrievedAt: dateValue(field(row, 19)),
      officialUrl: text(field(row, 20)),
    };
    if (family === "hpsa") {
      context.hpsa.push({ ...item, discipline: text(field(row, 2), "Medical underservice") });
    } else if (family === "mua_p") {
      context.muaP.push({ ...item, populationType: text(field(row, 13), text(field(row, 4))), imuScore: numberValue(field(row, 7)) });
    }
  }
  return context;
}

export async function getPublishedCountyBrief(geoid: string) {
  if (evidenceRuntimeEnvironment() === "test") {
    const fixture = await import("./approved-evidence-snapshot");
    return fixture.getApprovedCountyBrief(geoid);
  }
  const hash = runtimeSnapshotHash();
  if (!hash) return null;
  return loadPublishedBriefFromEvidenceCore(geoid, hash);
}

/**
 * Load the approved brief and its county projection as one snapshot-consistent
 * operation. The record is derived from that loaded brief and never triggers
 * a second full evidence query.
 */
export async function getPublishedCountyEvidence(geoid: string): Promise<{
  brief: ExplorePlaceBriefV1;
  record: CountyEvidenceSnapshotRecord;
} | null> {
  const brief = await getPublishedCountyBrief(geoid);
  if (!brief) return null;
  if (evidenceRuntimeEnvironment() === "test") {
    const fixture = await import("./approved-evidence-snapshot");
    const record = fixture.countyRecordByFips.get(geoid);
    return record ? { brief, record } : null;
  }
  const hash = runtimeSnapshotHash();
  if (!hash) return null;
  const record = runtimeRecordCache.get(`${geoid}:${hash}`) ?? countyRecordFromBrief(geoid, brief);
  runtimeRecordCache.set(`${geoid}:${hash}`, record);
  return { brief, record };
}

export async function getPublishedCountyBriefByIdentifier(identifier: string) {
  if (/^\d{5}$/.test(identifier)) return getPublishedCountyBrief(identifier);
  if (evidenceRuntimeEnvironment() === "test") {
    const fixture = await import("./approved-evidence-snapshot");
    const record = fixture.approvedCountyEvidenceSnapshot.counties.find((item) => {
      const brief = fixture.getApprovedCountyBrief(item.fips);
      return brief?.resolution.selected?.id === identifier;
    });
    return record ? fixture.getApprovedCountyBrief(record.fips) : null;
  }
  const result = await executeEvidenceSql(
    `SELECT authority_id FROM evidence.geography
      WHERE id=CAST(:identifier AS uuid) AND kind='county' AND authority='census'
        AND review_status='verified' LIMIT 1`,
    [{ name: "identifier", value: { stringValue: identifier } }],
  );
  const geoid = text(field(result.records?.[0], 0));
  return /^\d{5}$/.test(geoid) ? getPublishedCountyBrief(geoid) : null;
}

export async function getPublishedCountyRecord(geoid: string): Promise<CountyEvidenceSnapshotRecord | null> {
  if (evidenceRuntimeEnvironment() === "test") {
    const fixture = await import("./approved-evidence-snapshot");
    return fixture.countyRecordByFips.get(geoid) ?? null;
  }
  const evidence = await getPublishedCountyEvidence(geoid);
  return evidence?.record ?? null;
}

export async function findPublishedCounty(query: string) {
  if (evidenceRuntimeEnvironment() === "test") {
    const fixture = await import("./approved-evidence-snapshot");
    const normalized = query.trim().toLowerCase();
    const record = fixture.approvedCountyEvidenceSnapshot.counties.find((item) =>
      item.fips === query.trim()
      || item.county.toLowerCase() === normalized
      || `${item.county}, ${item.stateCode}`.toLowerCase() === normalized,
    );
    return record ? { record, brief: fixture.getApprovedCountyBrief(record.fips) } : null;
  }
  const result = await executeEvidenceSql(
    `SELECT authority_id FROM evidence.geography
      WHERE authority='census' AND kind='county' AND review_status='verified'
        AND (authority_id=:query OR lower(name)=lower(:query) OR lower(display_name)=lower(:query))
      ORDER BY vintage DESC LIMIT 1`,
    [{ name: "query", value: { stringValue: query.trim() } }],
  );
  const geoid = text(field(result.records?.[0], 0));
  if (!/^\d{5}$/.test(geoid)) return null;
  const brief = await getPublishedCountyBrief(geoid);
  const record = await getPublishedCountyRecord(geoid);
  return brief && record ? { brief, record } : null;
}
