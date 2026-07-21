import type { SourceAdapter } from "./types.ts";
import type { Geography } from "../contracts.ts";
import { fetchWithCache } from "../ingestion/cache.ts";
import type { AdapterBatch, AdapterContext, PublicDataAdapter, SourceQuery } from "../ingestion/types.ts";
import { csvObjects } from "./csv.ts";
import { assertOfficialSourceUrl, buildMeasure, buildObservation, buildSourceVersion, normalizeDate, numberOrNull } from "./runtime-utils.ts";

export type HrsaReleaseInput = {
  releaseLabel: string;
  reviewedDownloadUrls: string[];
  product: "hpsa" | "mua_p" | "ahrf";
};

export const hrsaAdapter: SourceAdapter<HrsaReleaseInput> = {
  id: "hrsa-workforce-v1",
  family: "hrsa",
  sourceId: "hrsa-workforce",
  buildReleasePlan(input) {
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      releaseLabel: `${input.product}:${input.releaseLabel}`,
      requests: input.reviewedDownloadUrls.map((url) => ({
        url,
        method: "GET" as const,
        purpose: `Ingest approved HRSA ${input.product} release with designation or variable-level dates.`,
        expectedMediaTypes: ["text/csv", "application/zip", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      })),
      requiresHumanReview: true,
      notes: [
        "Geographic, population-group, and facility designations remain separate.",
        "AHRF variable years are retained per observation and are not replaced by the file release year.",
      ],
    };
  },
};

export type HrsaColumnContract = {
  designationId: string;
  designationName: string;
  designationType: string;
  discipline: string;
  status: string;
  countyFips: string;
  geographyIdentificationNumber: string;
  componentTypeDescription: string;
  componentSourceId?: string;
  score?: string;
  designationDate?: string;
  lastUpdateDate?: string;
  recordCreateDate?: string;
};

export type HrsaAdapterConfig = {
  artifactUrl: string;
  releaseDate: string;
  releaseLabel: string;
  columns: HrsaColumnContract;
  includedStatuses?: string[];
};

export const HRSA_HPSA_ARTIFACTS = {
  primaryCare: "https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_PC.csv",
  dentalHealth: "https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_DH.csv",
  mentalHealth: "https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_MH.csv",
} as const;

export const HRSA_HPSA_COLUMNS: HrsaColumnContract = {
  designationId: "HPSA ID",
  designationName: "HPSA Name",
  designationType: "Designation Type",
  discipline: "HPSA Discipline Class",
  status: "HPSA Status",
  countyFips: "Common State County FIPS Code",
  geographyIdentificationNumber: "HPSA Geography Identification Number",
  componentTypeDescription: "HPSA Component Type Description",
  componentSourceId: "HPSA Component Source Identification Number",
  score: "HPSA Score",
  designationDate: "HPSA Designation Date",
  lastUpdateDate: "HPSA Designation Last Update Date",
  recordCreateDate: "Data Warehouse Record Create Date",
};

function isWholeCountyGeographicDesignation(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "geographic hpsa" || normalized === "geographic area" || normalized === "county";
}

export class HrsaHpsaIngestionAdapter implements PublicDataAdapter {
  readonly id = "hrsa-hpsa-v2";
  readonly sourceId = "hrsa-workforce";
  readonly config: HrsaAdapterConfig;

  constructor(config: HrsaAdapterConfig) {
    this.config = config;
  }

  releaseKey() {
    return `${this.config.releaseLabel}:${this.config.releaseDate}`;
  }

  supports(geography: Geography) {
    return geography.kind === "county" && /^\d{5}$/.test(geography.authorityId);
  }

  async fetch(query: SourceQuery, context: AdapterContext): Promise<AdapterBatch> {
    assertOfficialSourceUrl(this.sourceId, this.config.artifactUrl);
    const fetched = await fetchWithCache({
      url: this.config.artifactUrl,
      fetcher: context.fetcher,
      cache: context.cache,
      now: context.now,
      ttlMs: 22 * 60 * 60 * 1000,
    });
    const rows = csvObjects(fetched.body);
    const artifactReleaseDate = rows
      .map((row) => this.config.columns.recordCreateDate ? normalizeDate(row[this.config.columns.recordCreateDate]) : null)
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1) ?? this.config.releaseDate;
    const sourceVersion = buildSourceVersion({
      sourceId: this.sourceId,
      releaseLabel: this.config.releaseLabel,
      releaseDate: artifactReleaseDate,
      dataPeriodStart: null,
      dataPeriodEnd: artifactReleaseDate,
      retrievedAt: fetched.retrievedAt,
      staleAfterDays: 3,
      officialUrl: this.config.artifactUrl,
      content: fetched.body,
      schemaVersion: "hrsa-hpsa.csv.v2",
    });
    const measure = buildMeasure({
      sourceId: this.sourceId,
      sourceMeasureId: "HPSA_DESIGNATION",
      name: "Current HRSA shortage-area designation",
      description: "An official HPSA designation preserved by discipline, designation type, score, and status.",
      direction: "contextual",
      higherValueMeaning: "context_dependent",
      unit: "designation",
      universe: "HRSA Health Professional Shortage Area designations",
      adjustment: "not_applicable",
    });
    const observations = [];
    let rejected = 0;
    let nonCountyRows = 0;
    for (const row of rows) {
      if (row[this.config.columns.countyFips]?.padStart(5, "0") !== query.geography.authorityId) continue;
      const designationType = row[this.config.columns.designationType] ?? "";
      const componentType = row[this.config.columns.componentTypeDescription] ?? "";
      const geographyId = row[this.config.columns.geographyIdentificationNumber]?.padStart(5, "0") ?? "";
      const includedStatuses = this.config.includedStatuses ?? ["Designated", "Proposed For Withdrawal", "Proposed for Withdrawal"];
      if (!isWholeCountyGeographicDesignation(designationType)
        || componentType.trim().toLowerCase() !== "single county"
        || geographyId !== query.geography.authorityId
        || !includedStatuses.includes(row[this.config.columns.status] ?? "")) {
        nonCountyRows += 1;
        continue;
      }
      const designationId = row[this.config.columns.designationId]?.trim();
      if (!designationId) {
        rejected += 1;
        continue;
      }
      observations.push(buildObservation({
        measure,
        geography: query.geography,
        sourceVersion,
        sourceRecordId: [designationId, this.config.columns.componentSourceId ? row[this.config.columns.componentSourceId] ?? "" : ""].join(":"),
        sourceUrl: this.config.artifactUrl,
        value: row[this.config.columns.status] || true,
        numericValue: this.config.columns.score ? numberOrNull(row[this.config.columns.score]) : null,
        dataPeriodStart: this.config.columns.designationDate ? normalizeDate(row[this.config.columns.designationDate]) : null,
        dataPeriodEnd: null,
        sourceMetadata: {
          designationName: row[this.config.columns.designationName] ?? null,
          designationType,
          componentType,
          discipline: row[this.config.columns.discipline] ?? null,
          designationStatus: row[this.config.columns.status] ?? null,
          lastUpdateDate: this.config.columns.lastUpdateDate ? normalizeDate(row[this.config.columns.lastUpdateDate]) : null,
          wholeCountyGeographicDesignation: true,
        },
      }));
    }
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      status: fetched.stale ? "stale" : "available",
      statusReason: fetched.stale ? "The current HRSA artifact was unavailable; cached designations are labeled stale." : null,
      sourceVersion,
      measures: [measure],
      observations,
      recordsRead: rows.length,
      recordsAccepted: observations.length,
      recordsRejected: rejected,
      warnings: nonCountyRows
        ? [`${nonCountyRows} matching population-group or facility designation rows were retained outside the county-observation set; they were not converted into county findings.`]
        : [],
      cacheDisposition: fetched.disposition,
    };
  }
}
