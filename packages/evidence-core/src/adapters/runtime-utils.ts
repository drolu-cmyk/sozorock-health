import type {
  Geography,
  HigherValueMeaning,
  MeasureDefinition,
  MetricDirection,
  MetricObservation,
  ReviewStatus,
  SourceVersion,
} from "../contracts.ts";
import { deterministicUuid, sha256 } from "../ingestion/hash.ts";
import { sourceCatalogById } from "../source-catalog.ts";
import { validateAdapterRequest } from "./types.ts";

export function assertOfficialSourceUrl(sourceId: string, url: string) {
  const source = sourceCatalogById(sourceId);
  if (!source) throw new Error(`Unknown source catalog record: ${sourceId}`);
  const validation = validateAdapterRequest({
    url,
    method: "GET",
    purpose: "Retrieve a versioned official public-data artifact.",
    expectedMediaTypes: ["application/json", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  }, source);
  if (!validation.valid) throw new Error(`Official source URL validation failed: ${validation.errors.join(" ")}`);
}

export function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeDate(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  const candidate = us
    ? `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`
    : trimmed.slice(0, 10);
  return Number.isFinite(Date.parse(candidate)) ? candidate : null;
}

export function addDays(iso: string, days: number) {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

export function buildSourceVersion({
  sourceId,
  releaseLabel,
  releaseDate,
  dataPeriodStart,
  dataPeriodEnd,
  retrievedAt,
  staleAfterDays,
  officialUrl,
  content,
  schemaVersion,
  reviewStatus = "provisional",
}: {
  sourceId: string;
  releaseLabel: string;
  releaseDate: string;
  dataPeriodStart: string | null;
  dataPeriodEnd: string | null;
  retrievedAt: string;
  staleAfterDays: number;
  officialUrl: string;
  content: string;
  schemaVersion: string;
  reviewStatus?: ReviewStatus;
}): SourceVersion {
  const contentHash = sha256(content);
  return {
    id: deterministicUuid("source-version", sourceId, releaseLabel, contentHash),
    sourceId,
    releaseLabel,
    releaseDate,
    dataPeriodStart,
    dataPeriodEnd,
    retrievedAt,
    staleAfter: addDays(retrievedAt, staleAfterDays),
    officialUrl,
    contentHash,
    schemaVersion,
    reviewStatus,
    reviewedBy: null,
    reviewedAt: null,
  };
}

export function buildMeasure({
  sourceId,
  sourceMeasureId,
  name,
  description,
  direction,
  higherValueMeaning,
  unit,
  universe,
  adjustment,
}: {
  sourceId: string;
  sourceMeasureId: string;
  name: string;
  description: string;
  direction: MetricDirection;
  higherValueMeaning: HigherValueMeaning;
  unit: MeasureDefinition["unit"];
  universe: string;
  adjustment: MeasureDefinition["adjustment"];
}): MeasureDefinition {
  const comparisonPolicy = higherValueMeaning === "adverse"
    ? "higher_is_concern"
    : higherValueMeaning === "favorable"
      ? "lower_is_concern"
      : higherValueMeaning === "context_dependent"
        ? "context_only"
        : "not_rankable";
  return {
    id: deterministicUuid("measure", sourceId, sourceMeasureId),
    sourceMeasureId,
    name,
    description,
    direction,
    higherValueMeaning,
    unit,
    universe,
    adjustment,
    comparisonPolicy,
    reviewStatus: "provisional",
  };
}

export function buildObservation({
  measure,
  geography,
  sourceVersion,
  sourceRecordId,
  sourceUrl,
  value,
  numericValue,
  confidenceLow = null,
  confidenceHigh = null,
  marginOfError = null,
  dataPeriodStart,
  dataPeriodEnd,
  suppressionReason = null,
  sourceMetadata = {},
}: {
  measure: MeasureDefinition;
  geography: Geography;
  sourceVersion: SourceVersion;
  sourceRecordId: string;
  sourceUrl: string;
  value: MetricObservation["value"];
  numericValue: number | null;
  confidenceLow?: number | null;
  confidenceHigh?: number | null;
  marginOfError?: number | null;
  dataPeriodStart: string | null;
  dataPeriodEnd: string | null;
  suppressionReason?: string | null;
  sourceMetadata?: MetricObservation["sourceMetadata"];
}): MetricObservation {
  return {
    id: deterministicUuid("observation", measure.id, geography.id, sourceVersion.id, sourceRecordId),
    measureDefinitionId: measure.id,
    geographyId: geography.id,
    sourceVersionId: sourceVersion.id,
    sourceRecordId,
    sourceUrl,
    geographyLevel: geography.kind,
    value,
    numericValue,
    confidenceLow,
    confidenceHigh,
    marginOfError,
    releaseDate: sourceVersion.releaseDate,
    dataPeriodStart,
    dataPeriodEnd,
    retrievedAt: sourceVersion.retrievedAt,
    reviewStatus: "provisional",
    suppressionReason,
    sourceMetadata,
  };
}
