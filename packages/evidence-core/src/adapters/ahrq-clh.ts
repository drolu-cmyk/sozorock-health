import type { SourceAdapter } from "./types.ts";
import type { Geography, HigherValueMeaning, MeasureDefinition } from "../contracts.ts";
import type { AdapterBatch, AdapterContext, PublicDataAdapter, SourceQuery } from "../ingestion/types.ts";
import { assertOfficialSourceUrl, buildMeasure, buildObservation, buildSourceVersion, numberOrNull } from "./runtime-utils.ts";

export type AhrqClhReleaseInput = {
  releaseLabel: string;
  reviewedDownloadUrls: string[];
};

export const AHRQ_CLH_2023_COUNTY_ARTIFACT =
  "https://www.ahrq.gov/sites/default/files/wysiwyg/sdoh/clh_2023_county_2_0.xlsx";
export const AHRQ_CLH_2023_CODEBOOK =
  "https://www.ahrq.gov/sites/default/files/wysiwyg/sdoh/clh_2023_codebook_2_0.xlsx";

export const ahrqClhAdapter: SourceAdapter<AhrqClhReleaseInput> = {
  id: "ahrq-clh-v1",
  family: "ahrq_clh",
  sourceId: "ahrq-clh",
  buildReleasePlan(input) {
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      releaseLabel: input.releaseLabel,
      requests: input.reviewedDownloadUrls.map((url) => ({
        url,
        method: "GET" as const,
        purpose: "Ingest an approved AHRQ Community-Level Health release artifact.",
        expectedMediaTypes: ["application/zip", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"],
      })),
      requiresHumanReview: true,
      notes: [
        "Variable-specific years and geography grain are preserved.",
        "A new CLH database version cannot be joined to a predecessor version until compatibility is reviewed.",
      ],
    };
  },
};

export type AhrqClhVariableContract = {
  sourceMeasureId: string;
  name: string;
  description: string;
  universe: string;
  unit: MeasureDefinition["unit"];
  higherValueMeaning: HigherValueMeaning;
  dataYearField?: string;
};

export type AhrqTabularArtifactReader = (input: {
  artifactUrl: string;
  fetcher: AdapterContext["fetcher"];
}) => Promise<{ rows: Record<string, string | number | null>[]; contentHashInput: string; retrievedAt: string }>;

export type AhrqClhAdapterConfig = {
  releaseLabel: string;
  releaseDate: string;
  artifactUrl: string;
  geographyKind: "county" | "postal_zip";
  geographyIdField: string;
  variables: AhrqClhVariableContract[];
  reader?: AhrqTabularArtifactReader;
};

export class AhrqClhIngestionAdapter implements PublicDataAdapter {
  readonly id = "ahrq-clh-v2";
  readonly sourceId = "ahrq-clh";
  readonly config: AhrqClhAdapterConfig;

  constructor(config: AhrqClhAdapterConfig) {
    this.config = config;
  }

  releaseKey() {
    return `${this.config.releaseLabel}:${this.config.releaseDate}`;
  }

  supports(geography: Geography) {
    return geography.kind === this.config.geographyKind;
  }

  async fetch(query: SourceQuery, context: AdapterContext): Promise<AdapterBatch> {
    assertOfficialSourceUrl(this.sourceId, this.config.artifactUrl);
    if (!this.config.reader) {
      return {
        adapterId: this.id,
        sourceId: this.sourceId,
        status: "unavailable",
        statusReason: "The official AHRQ CLH artifact is XLSX. This release remains unavailable until its codebook and an approved XLSX reader are registered together.",
        sourceVersion: null,
        measures: [],
        observations: [],
        recordsRead: 0,
        recordsAccepted: 0,
        recordsRejected: 0,
        warnings: ["The adapter does not reinterpret AHRQ ZIP Code rows as Census ZCTAs."],
        cacheDisposition: "miss",
      };
    }
    const artifact = await this.config.reader({ artifactUrl: this.config.artifactUrl, fetcher: context.fetcher });
    const variableYears = artifact.rows.flatMap((row) => this.config.variables
      .map((variable) => variable.dataYearField ? numberOrNull(row[variable.dataYearField]) : null)
      .filter((year): year is number => year !== null))
      .sort((left, right) => left - right);
    const sourceVersion = buildSourceVersion({
      sourceId: this.sourceId,
      releaseLabel: this.config.releaseLabel,
      releaseDate: this.config.releaseDate,
      dataPeriodStart: variableYears.length ? `${variableYears[0]}-01-01` : null,
      dataPeriodEnd: variableYears.length ? `${variableYears.at(-1)}-12-31` : null,
      retrievedAt: artifact.retrievedAt,
      staleAfterDays: 430,
      officialUrl: this.config.artifactUrl,
      content: artifact.contentHashInput,
      schemaVersion: "ahrq-clh.v2",
    });
    const measures = this.config.variables.map((variable) => buildMeasure({
      sourceId: this.sourceId,
      sourceMeasureId: variable.sourceMeasureId,
      name: variable.name,
      description: variable.description,
      direction: variable.higherValueMeaning === "adverse" ? "adverse" : variable.higherValueMeaning === "favorable" ? "protective" : "contextual",
      higherValueMeaning: variable.higherValueMeaning,
      unit: variable.unit,
      universe: variable.universe,
      adjustment: "not_applicable",
    }));
    const observations = [];
    let rejectedRows = 0;
    const acceptedSourceRows = new Set<number>();
    for (const [rowIndex, row] of artifact.rows.entries()) {
      if (String(row[this.config.geographyIdField] ?? "").padStart(5, "0") !== query.geography.authorityId) continue;
      let rowPublished = false;
      for (const [index, variable] of this.config.variables.entries()) {
        const value = numberOrNull(row[variable.sourceMeasureId]);
        if (value === null) continue;
        const yearValue = variable.dataYearField ? numberOrNull(row[variable.dataYearField]) : null;
        const year = yearValue ? String(yearValue) : null;
        observations.push(buildObservation({
          measure: measures[index],
          geography: query.geography,
          sourceVersion,
          sourceRecordId: [query.geography.authorityId, variable.sourceMeasureId, year ?? "unknown"].join(":"),
          sourceUrl: this.config.artifactUrl,
          value,
          numericValue: value,
          dataPeriodStart: year ? `${year}-01-01` : null,
          dataPeriodEnd: year ? `${year}-12-31` : null,
          sourceMetadata: {
            variableId: variable.sourceMeasureId,
            variableYear: year,
            ahrqGeographyLabel: this.config.geographyKind,
          },
        }));
        acceptedSourceRows.add(rowIndex);
        rowPublished = true;
      }
      if (!rowPublished) rejectedRows += 1;
    }
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      status: "available",
      statusReason: null,
      sourceVersion,
      measures,
      observations,
      recordsRead: artifact.rows.length,
      recordsAccepted: acceptedSourceRows.size,
      recordsRejected: rejectedRows,
      warnings: ["CLH variable years are retained per observation; CLH v2 is not joined to the retired SDOH database version."],
      cacheDisposition: "miss",
    };
  }
}
