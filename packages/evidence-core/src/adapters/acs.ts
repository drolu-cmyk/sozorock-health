import type { SourceAdapter } from "./types.ts";
import type { Geography, HigherValueMeaning, MeasureDefinition } from "../contracts.ts";
import { fetchWithCache } from "../ingestion/cache.ts";
import type { AdapterBatch, AdapterContext, PublicDataAdapter, SourceQuery } from "../ingestion/types.ts";
import { assertOfficialSourceUrl, buildMeasure, buildObservation, buildSourceVersion, numberOrNull } from "./runtime-utils.ts";

export type AcsReleaseInput = {
  releaseLabel: string;
  reviewedApiUrls: string[];
};

export const acsAdapter: SourceAdapter<AcsReleaseInput> = {
  id: "census-acs5-v1",
  family: "acs",
  sourceId: "census-acs5",
  buildReleasePlan(input) {
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      releaseLabel: input.releaseLabel,
      requests: input.reviewedApiUrls.map((url) => ({
        url,
        method: "GET" as const,
        purpose: "Ingest approved ACS five-year estimate and margin-of-error variables.",
        expectedMediaTypes: ["application/json", "text/csv"],
      })),
      requiresHumanReview: true,
      notes: [
        "Every variable must have an approved universe, label, estimate field, margin-of-error field, and geography contract.",
        "Planning-region aggregation is blocked until a documented relationship and aggregation rule are approved.",
      ],
    };
  },
};

export type AcsVariableContract = {
  estimate: string;
  marginOfError?: string;
  name: string;
  description: string;
  universe: string;
  unit: MeasureDefinition["unit"];
  higherValueMeaning: HigherValueMeaning;
};

export type AcsAdapterConfig = {
  vintage: number;
  releaseDate: string;
  variables: AcsVariableContract[];
  apiKey?: string;
};

const DEFAULT_ACS_VARIABLES: AcsVariableContract[] = [
  {
    estimate: "B01001_001E",
    marginOfError: "B01001_001M",
    name: "Total population",
    description: "ACS five-year estimate of the total population.",
    universe: "Total population",
    unit: "count",
    higherValueMeaning: "neutral",
  },
  {
    estimate: "B17001_002E",
    marginOfError: "B17001_002M",
    name: "Population below the poverty level",
    description: "ACS five-year count of people whose poverty status was determined and who are below the poverty level.",
    universe: "Population for whom poverty status is determined",
    unit: "count",
    higherValueMeaning: "adverse",
  },
];

function acsGeographyClause(geography: Geography) {
  if (geography.kind === "county" && geography.stateFips && geography.authorityId.length === 5) {
    return `for=county:${geography.authorityId.slice(2)}&in=state:${geography.stateFips}`;
  }
  if (geography.kind === "zcta") return `for=zip%20code%20tabulation%20area:${geography.authorityId}`;
  if (geography.kind === "census_place" && geography.stateFips) {
    const placeCode = geography.authorityId.length === 7 ? geography.authorityId.slice(2) : geography.authorityId;
    return `for=place:${placeCode}&in=state:${geography.stateFips}`;
  }
  if (geography.kind === "state") return `for=state:${geography.authorityId}`;
  return null;
}

function acsUrls(config: AcsAdapterConfig, geography: Geography) {
  const clause = acsGeographyClause(geography);
  if (!clause) throw new Error(`ACS adapter does not support ${geography.kind} without an exact Census API geography contract.`);
  const variables = ["NAME", ...config.variables.flatMap((variable) => [variable.estimate, variable.marginOfError].filter(Boolean))];
  const sourceUrl = `https://api.census.gov/data/${config.vintage}/acs/acs5?get=${variables.join(",")}&${clause}`;
  const requestUrl = config.apiKey ? `${sourceUrl}&key=${encodeURIComponent(config.apiKey)}` : sourceUrl;
  return { requestUrl, sourceUrl };
}

function rowMatchesGeography(headers: string[], values: string[], geography: Geography) {
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  if (geography.kind === "county") return `${row.state ?? ""}${row.county ?? ""}` === geography.authorityId;
  if (geography.kind === "zcta") return row["zip code tabulation area"] === geography.authorityId;
  if (geography.kind === "census_place") {
    const authority = geography.authorityId.length === 7 ? geography.authorityId.slice(2) : geography.authorityId;
    return row.state === geography.stateFips && row.place === authority;
  }
  return geography.kind === "state" && row.state === geography.authorityId;
}

export class AcsIngestionAdapter implements PublicDataAdapter {
  readonly id = "census-acs5-v2";
  readonly sourceId = "census-acs5";
  readonly config: AcsAdapterConfig;

  constructor(config: Partial<AcsAdapterConfig> & Pick<AcsAdapterConfig, "vintage" | "releaseDate">) {
    this.config = { ...config, variables: config.variables ?? DEFAULT_ACS_VARIABLES };
  }

  releaseKey() {
    return `${this.config.vintage}:${this.config.releaseDate}`;
  }

  supports(geography: Geography) {
    return acsGeographyClause(geography) !== null;
  }

  async fetch(query: SourceQuery, context: AdapterContext): Promise<AdapterBatch> {
    if (!this.config.apiKey) {
      return {
        adapterId: this.id,
        sourceId: this.sourceId,
        status: "unavailable",
        statusReason: "The Census API requires an API key. Configure CENSUS_API_KEY in the ingestion runtime; the key is never stored in evidence or cache metadata.",
        sourceVersion: null,
        measures: [],
        observations: [],
        recordsRead: 0,
        recordsAccepted: 0,
        recordsRejected: 0,
        warnings: [],
        cacheDisposition: "miss",
      };
    }
    const { requestUrl, sourceUrl } = acsUrls(this.config, query.geography);
    assertOfficialSourceUrl(this.sourceId, sourceUrl);
    const fetched = await fetchWithCache({
      url: requestUrl,
      publicUrl: sourceUrl,
      cacheKey: sourceUrl,
      fetcher: context.fetcher,
      cache: context.cache,
      now: context.now,
      ttlMs: 30 * 86_400_000,
    });
    const payload = JSON.parse(fetched.body) as unknown;
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) throw new Error("ACS response must be a header row followed by value rows.");
    const [headerRow, ...valueRows] = payload as string[][];
    const sourceVersion = buildSourceVersion({
      sourceId: this.sourceId,
      releaseLabel: `${this.config.vintage} ACS 5-year`,
      releaseDate: this.config.releaseDate,
      dataPeriodStart: `${this.config.vintage - 4}-01-01`,
      dataPeriodEnd: `${this.config.vintage}-12-31`,
      retrievedAt: fetched.retrievedAt,
      staleAfterDays: 430,
      officialUrl: `https://api.census.gov/data/${this.config.vintage}/acs/acs5.html`,
      content: fetched.body,
      schemaVersion: `acs5.${this.config.vintage}.v2`,
    });
    const measures = this.config.variables.map((variable) => buildMeasure({
      sourceId: this.sourceId,
      sourceMeasureId: variable.estimate,
      name: variable.name,
      description: variable.description,
      direction: variable.higherValueMeaning === "adverse" ? "adverse" : variable.higherValueMeaning === "favorable" ? "protective" : "contextual",
      higherValueMeaning: variable.higherValueMeaning,
      unit: variable.unit,
      universe: variable.universe,
      adjustment: "not_applicable",
    }));
    const measureById = new Map(measures.map((measure) => [measure.sourceMeasureId, measure]));
    const observations = [];
    let rejected = 0;
    for (const values of valueRows) {
      if (!rowMatchesGeography(headerRow, values, query.geography)) {
        rejected += 1;
        continue;
      }
      const row = Object.fromEntries(headerRow.map((header, index) => [header, values[index]]));
      for (const variable of this.config.variables) {
        const measure = measureById.get(variable.estimate);
        if (!measure) continue;
        const value = numberOrNull(row[variable.estimate]);
        observations.push(buildObservation({
          measure,
          geography: query.geography,
          sourceVersion,
          sourceRecordId: [this.config.vintage, query.geography.kind, query.geography.authorityId, variable.estimate].join(":"),
          sourceUrl,
          value,
          numericValue: value,
          marginOfError: variable.marginOfError ? numberOrNull(row[variable.marginOfError]) : null,
          dataPeriodStart: sourceVersion.dataPeriodStart,
          dataPeriodEnd: sourceVersion.dataPeriodEnd,
          suppressionReason: value === null ? "ACS did not publish a numeric estimate for this geography and variable." : null,
          sourceMetadata: {
            variableId: variable.estimate,
            marginOfErrorVariableId: variable.marginOfError ?? null,
            name: row.NAME ?? null,
            censusApiGeography: query.geography.kind,
          },
        }));
      }
    }
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      status: fetched.stale ? "stale" : "available",
      statusReason: fetched.stale ? "The Census API was unavailable; cached ACS values are labeled stale." : null,
      sourceVersion,
      measures,
      observations,
      recordsRead: valueRows.length,
      recordsAccepted: valueRows.length - rejected,
      recordsRejected: rejected,
      warnings: ["ACS estimates retain their Census geography, vintage, universe, and margin of error."],
      cacheDisposition: fetched.disposition,
    };
  }
}
