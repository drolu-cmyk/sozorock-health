import type { SourceAdapter } from "./types.ts";
import type { Geography, HigherValueMeaning } from "../contracts.ts";
import { fetchWithCache } from "../ingestion/cache.ts";
import type { AdapterBatch, PublicDataAdapter, SourceQuery, AdapterContext } from "../ingestion/types.ts";
import { assertOfficialSourceUrl, buildMeasure, buildObservation, buildSourceVersion, numberOrNull } from "./runtime-utils.ts";

export type CdcPlacesReleaseInput = {
  releaseLabel: string;
  reviewedDatasetUrls: string[];
};

export const cdcPlacesAdapter: SourceAdapter<CdcPlacesReleaseInput> = {
  id: "cdc-places-v1",
  family: "cdc_places",
  sourceId: "cdc-places",
  buildReleasePlan(input) {
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      releaseLabel: input.releaseLabel,
      requests: input.reviewedDatasetUrls.map((url) => ({
        url,
        method: "GET" as const,
        purpose: "Ingest an approved PLACES release for a declared geography and measure contract.",
        expectedMediaTypes: ["application/json", "text/csv"],
      })),
      requiresHumanReview: true,
      notes: [
        "Measure definitions, universes, release dates, source periods, adjustment, and confidence intervals are versioned before values are accepted.",
        "Modeled estimates remain distinct from local planning priorities and cannot be used for overall place ranking.",
      ],
    };
  },
};

type PlacesRow = Record<string, string | null | undefined>;

const DEFAULT_DATASETS: Record<"county" | "census_place" | "zcta", string> = {
  county: "swc5-untb",
  census_place: "eav7-hnsx",
  zcta: "qnzd-25i4",
};

const DEFAULT_MEANINGS: Record<string, HigherValueMeaning> = {
  ACCESS2: "adverse",
  ARTHRITIS: "adverse",
  BPHIGH: "adverse",
  CANCER: "adverse",
  CASTHMA: "adverse",
  CHD: "adverse",
  COPD: "adverse",
  DEPRESSION: "adverse",
  DIABETES: "adverse",
  KIDNEY: "adverse",
  OBESITY: "adverse",
  STROKE: "adverse",
  CHECKUP: "favorable",
  CHOLSCREEN: "favorable",
  COLON_SCREEN: "favorable",
  DENTAL: "favorable",
  MAMMOUSE: "favorable",
};

export type CdcPlacesAdapterConfig = {
  releaseLabel: string;
  releaseDate: string;
  datasetIds?: Partial<typeof DEFAULT_DATASETS>;
  dataPeriodByMeasure?: Record<string, { start: string; end: string }>;
};

function placesDatasetKind(geography: Geography) {
  return geography.kind === "county" || geography.kind === "census_place" || geography.kind === "zcta"
    ? geography.kind
    : null;
}

function placesUrl(datasetId: string, geography: Geography, measureIds: string[]) {
  const select = [
    "year", "locationid", "locationname", "measureid", "measure", "datasource",
    "data_value_unit", "datavaluetypeid", "data_value_type", "data_value",
    "low_confidence_limit", "high_confidence_limit", "data_value_footnote",
  ].join(",");
  const filters = [`locationid='${geography.authorityId.replaceAll("'", "''")}'`];
  if (measureIds.length) filters.push(`measureid in(${measureIds.map((id) => `'${id.replaceAll("'", "''")}'`).join(",")})`);
  const params = new URLSearchParams({ $select: select, $where: filters.join(" and "), $limit: "5000" });
  return `https://data.cdc.gov/resource/${datasetId}.json?${params.toString()}`;
}

function periodFor(row: PlacesRow, configured?: { start: string; end: string }) {
  if (configured) return configured;
  const year = /^\d{4}$/.test(row.year ?? "") ? String(row.year) : null;
  return year ? { start: `${year}-01-01`, end: `${year}-12-31` } : { start: null, end: null };
}

export class CdcPlacesIngestionAdapter implements PublicDataAdapter {
  readonly id = "cdc-places-v2";
  readonly sourceId = "cdc-places";
  readonly config: CdcPlacesAdapterConfig;

  constructor(config: CdcPlacesAdapterConfig) {
    this.config = config;
  }

  releaseKey() {
    return `${this.config.releaseLabel}:${this.config.releaseDate}`;
  }

  supports(geography: Geography) {
    return placesDatasetKind(geography) !== null;
  }

  async fetch(query: SourceQuery, context: AdapterContext): Promise<AdapterBatch> {
    const kind = placesDatasetKind(query.geography);
    if (!kind) throw new Error(`CDC PLACES does not publish ${query.geography.kind} observations.`);
    const datasetId = this.config.datasetIds?.[kind] ?? DEFAULT_DATASETS[kind];
    const requested = query.requestedMeasureIds ?? [];
    const url = placesUrl(datasetId, query.geography, requested);
    assertOfficialSourceUrl(this.sourceId, url);
    const fetched = await fetchWithCache({
      url,
      fetcher: context.fetcher,
      cache: context.cache,
      now: context.now,
      ttlMs: 7 * 86_400_000,
    });
    const parsed = JSON.parse(fetched.body) as unknown;
    if (!Array.isArray(parsed)) throw new Error("CDC PLACES response must be a JSON row array.");
    const rows = parsed as PlacesRow[];
    const sourcePeriods = rows
      .map((row) => periodFor(row, row.measureid ? this.config.dataPeriodByMeasure?.[row.measureid] : undefined))
      .filter((period): period is { start: string; end: string } => period.start !== null && period.end !== null);
    const sourcePeriodStarts = sourcePeriods.map((period) => period.start).sort();
    const sourcePeriodEnds = sourcePeriods.map((period) => period.end).sort();
    const sourceVersion = buildSourceVersion({
      sourceId: this.sourceId,
      releaseLabel: this.config.releaseLabel,
      releaseDate: this.config.releaseDate,
      dataPeriodStart: sourcePeriodStarts[0] ?? null,
      dataPeriodEnd: sourcePeriodEnds.at(-1) ?? null,
      retrievedAt: fetched.retrievedAt,
      staleAfterDays: 400,
      officialUrl: `https://data.cdc.gov/d/${datasetId}`,
      content: fetched.body,
      schemaVersion: `cdc-places.${datasetId}.v2`,
    });
    const measureMap = new Map<string, ReturnType<typeof buildMeasure>>();
    const observations = [];
    let rejected = 0;
    for (const row of rows) {
      const locationId = row.locationid ?? row.locationname;
      const measureId = row.measureid;
      const valueTypeId = row.datavaluetypeid ?? row.data_value_typeid ?? row.data_value_type;
      if (locationId !== query.geography.authorityId || !measureId || !valueTypeId) {
        rejected += 1;
        continue;
      }
      const sourceMeasureId = `${measureId}:${valueTypeId}`;
      let measure = measureMap.get(sourceMeasureId);
      if (!measure) {
        const meaning = DEFAULT_MEANINGS[measureId] ?? "context_dependent";
        measure = buildMeasure({
          sourceId: this.sourceId,
          sourceMeasureId,
          name: row.measure ?? measureId,
          description: `${row.data_value_type ?? "Modeled estimate"} from CDC PLACES; it is not patient-level data.`,
          direction: meaning === "adverse" ? "adverse" : meaning === "favorable" ? "protective" : "contextual",
          higherValueMeaning: meaning,
          unit: row.data_value_unit === "%" ? "percent" : "rate",
          universe: "See the CDC PLACES measure definition for the eligible population.",
          adjustment: String(row.data_value_type ?? "").toLowerCase().includes("age-adjusted") ? "age_adjusted" : "modeled",
        });
        measureMap.set(sourceMeasureId, measure);
      }
      const period = periodFor(row, this.config.dataPeriodByMeasure?.[measureId]);
      const numericValue = numberOrNull(row.data_value);
      observations.push(buildObservation({
        measure,
        geography: query.geography,
        sourceVersion,
        sourceRecordId: [datasetId, locationId, measureId, valueTypeId, row.year ?? "unknown"].join(":"),
        sourceUrl: url,
        value: numericValue,
        numericValue,
        confidenceLow: numberOrNull(row.low_confidence_limit),
        confidenceHigh: numberOrNull(row.high_confidence_limit),
        dataPeriodStart: period.start,
        dataPeriodEnd: period.end,
        suppressionReason: numericValue === null ? row.data_value_footnote ?? "No value published." : null,
        sourceMetadata: {
          datasetId,
          measureId,
          dataValueTypeId: valueTypeId,
          dataSource: row.datasource ?? null,
          modeledEstimate: true,
        },
      }));
    }
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      status: fetched.stale ? "stale" : "available",
      statusReason: fetched.stale ? "The official endpoint was unavailable; a previously cached response is being retained and labeled stale." : null,
      sourceVersion,
      measures: [...measureMap.values()],
      observations,
      recordsRead: rows.length,
      recordsAccepted: rows.length - rejected,
      recordsRejected: rejected,
      warnings: [
        "PLACES observations are modeled area estimates and are not local diagnoses, patient records, or proof of a local planning priority.",
        ...(rows.length === 0 ? ["The current dataset published no rows for the requested geography and measures; missing coverage is not interpreted as zero."] : []),
      ],
      cacheDisposition: fetched.disposition,
    };
  }
}
