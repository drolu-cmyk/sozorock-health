import {
  buildCountyPlaceBrief,
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

function dateValue(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function citationId(observationId: string) {
  return `runtime-citation:${observationId}`;
}

async function loadPublishedBriefFromEvidenceCore(geoid: string): Promise<ExplorePlaceBriefV1 | null> {
  const snapshotResult = await executeEvidenceSql(
    `SELECT s.id::text, s.content_hash, s.policy_version, s.created_at::text,
            sv.id::text, sv.release_date::text, sv.data_period_start::text,
            sv.data_period_end::text, sv.retrieved_at::text, sv.official_url
       FROM evidence.evidence_snapshot s
       JOIN evidence.snapshot_source_version link ON link.snapshot_id=s.id
       JOIN evidence.source_version sv ON sv.id=link.source_version_id
      WHERE s.review_status='verified' AND s.published_at IS NOT NULL
        AND sv.source_id='cdc-places'
      ORDER BY s.published_at DESC
      LIMIT 1`,
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
      WHERE link.snapshot_id=CAST(:snapshot_id AS uuid)
        AND sv.review_status='verified'`,
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
  const sourceVersionById = new Map(sourceVersions.map((source) => [source.id, source]));

  const geographyResult = await executeEvidenceSql(
    `SELECT id::text, name, display_name, state_fips, county_fips, vintage,
            ST_Y(point_on_surface)::double precision,
            ST_X(point_on_surface)::double precision
       FROM evidence.geography
      WHERE authority='census' AND kind='county' AND authority_id=:geoid
        AND review_status='verified'
      ORDER BY vintage DESC
      LIMIT 1`,
    [{ name: "geoid", value: { stringValue: geoid } }],
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
            o.source_url
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
    const placeholders = contextSourceIds.map((_, index) => `:context_source_${index}`).join(", ");
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
              sv.data_period_end::text, sv.retrieved_at::text
         FROM evidence.metric_observation o
         JOIN evidence.measure_definition d ON d.id=o.measure_definition_id
         JOIN evidence.source_version sv ON sv.id=o.source_version_id
        WHERE o.geography_id=CAST(:geography_id AS uuid)
          AND o.source_version_id IN (${placeholders})
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
      citations.push({
        id: cite,
        sourceVersionId,
        documentId: null,
        officialUrl: text(field(row, 19), metadata.officialUrl),
        pageNumber: null,
        section: null,
        sourceField: field(row, 2) === null ? null : text(field(row, 2), text(field(row, 3))),
        quotedText: null,
        reviewStatus: "verified",
      });
    }
  }
  record.dataCoverage = Object.keys(MEASURE_GROUPS).length ? Math.round((cdcObservationCount / Object.keys(MEASURE_GROUPS).length) * 100) : 0;
  record.sourceStatus = cdcObservationCount ? "available" : "unavailable";
  runtimeRecordCache.set(geoid, record);

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
  return brief;
}

export async function getPublishedWorkforceContext(geoid: string): Promise<PublishedWorkforceContext> {
  if (evidenceRuntimeEnvironment() === "test") {
    const fixture = await import("./approved-evidence-snapshot");
    return fixture.getHrsaCountyContext(geoid);
  }
  const result = await executeEvidenceSql(
    `SELECT d.source_record_id, d.designation_family, d.discipline,
            d.designation_name, d.designation_type, d.component_type, d.status,
            d.score, d.designation_date::text, d.last_update_date::text,
            d.whole_county, d.source_scope, d.source_metadata::text,
            COALESCE(d.source_metadata->>'populationType', d.source_metadata->>'population_type', d.designation_type)
       FROM evidence.workforce_designation d
       JOIN evidence.geography g ON g.id=d.geography_id
      WHERE g.authority='census' AND g.kind='county' AND g.authority_id=:geoid
        AND d.review_status='verified'
      ORDER BY d.designation_family, d.source_record_id`,
    [{ name: "geoid", value: { stringValue: geoid } }],
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
  return loadPublishedBriefFromEvidenceCore(geoid);
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
  const brief = await getPublishedCountyBrief(geoid);
  if (!brief?.resolution.selected) return null;
  const cached = runtimeRecordCache.get(geoid);
  if (cached) return cached;
  const record: CountyEvidenceSnapshotRecord = {
    fips: geoid,
    stateFips: geoid.slice(0, 2),
    countyFips: geoid.slice(2),
    state: "",
    stateCode: STATE_CODES[geoid.slice(0, 2)] ?? geoid.slice(0, 2),
    county: brief.resolution.selected.displayName.split(",")[0] ?? brief.resolution.selected.displayName,
    centroid: { lat: 0, lon: 0 },
    landSquareMiles: 0,
    population: null,
    adultPopulation: null,
    conditions: {}, barriers: {}, prevention: {}, dataCoverage: 0, sourceStatus: "unavailable",
  };
  for (const observation of brief.publicData.observations) {
    const sourceMeasure = brief.citations.find((citation) => citation.id === observation.citationIds[0])?.sourceField?.replace(/:Crude$/i, "");
    const mapping = sourceMeasure ? MEASURE_GROUPS[sourceMeasure] : undefined;
    if (mapping && typeof observation.value === "number") {
      record[mapping.group][mapping.field] = {
        value: observation.value,
        ci: observation.confidence.low !== null && observation.confidence.high !== null
          ? [observation.confidence.low, observation.confidence.high]
          : null,
      };
    }
  }
  record.dataCoverage = brief.publicData.observations.length;
  record.sourceStatus = brief.publicData.observations.length ? "available" : "unavailable";
  return record;
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
