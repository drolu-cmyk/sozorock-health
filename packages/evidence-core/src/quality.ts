import type {
  EvidenceCitation,
  EvidenceClaim,
  MeasureDefinition,
  MetricObservation,
  PlanningDocument,
  ReviewStatus,
  SourceCatalogRecord,
  SourceVersion,
} from "./contracts.ts";

export type ValidationResult = { valid: boolean; errors: string[] };

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSha256(value: string) {
  return /^sha256:[a-f0-9]{64}$/i.test(value);
}

function result(errors: string[]): ValidationResult {
  return { valid: errors.length === 0, errors };
}

export function effectiveFreshnessStatus(source: SourceVersion, asOf: string): ReviewStatus {
  if (source.reviewStatus === "rejected" || source.reviewStatus === "unavailable") return source.reviewStatus;
  const staleAfter = dateValue(source.staleAfter);
  const comparison = dateValue(asOf);
  if (staleAfter === null || comparison === null || comparison > staleAfter) return "stale";
  return source.reviewStatus;
}

export function validateSourceVersion(
  source: SourceVersion,
  catalog: SourceCatalogRecord,
  asOf: string,
): ValidationResult {
  const errors: string[] = [];
  if (source.sourceId !== catalog.id) errors.push("Source version does not belong to the supplied source catalog record.");
  if (!catalog.allowedHosts.some((host) => {
    try {
      const hostname = new URL(source.officialUrl).hostname;
      return hostname === host || hostname.endsWith(`.${host}`);
    } catch {
      return false;
    }
  })) errors.push("Source version URL is not on an approved official host.");
  for (const [label, value] of [["releaseDate", source.releaseDate], ["retrievedAt", source.retrievedAt], ["staleAfter", source.staleAfter]] as const) {
    if (dateValue(value) === null) errors.push(`${label} must be an ISO-compatible date.`);
  }
  if (source.dataPeriodStart && source.dataPeriodEnd
    && (dateValue(source.dataPeriodStart) ?? 0) > (dateValue(source.dataPeriodEnd) ?? 0)) {
    errors.push("Source data period start must not follow its end.");
  }
  if (!isSha256(source.contentHash)) errors.push("Source version requires a SHA-256 content hash.");
  if (source.reviewStatus === "verified" && (!source.reviewedBy || !source.reviewedAt)) {
    errors.push("Verified source versions require a named reviewer and review date.");
  }
  if (source.reviewStatus === "verified" && effectiveFreshnessStatus(source, asOf) === "stale") {
    errors.push("A source version cannot remain verified after its stale-after date without review.");
  }
  return result(errors);
}

export type ComparisonInterpretation = {
  status: "adverse_signal" | "favorable_signal" | "context_only" | "not_rankable" | "missing" | "equal";
  difference: number | null;
  rankable: boolean;
};

export function interpretMetricComparison(
  definition: MeasureDefinition,
  observation: number | null,
  benchmark: number | null,
): ComparisonInterpretation {
  if (observation === null || benchmark === null) return { status: "missing", difference: null, rankable: false };
  const difference = observation - benchmark;
  if (definition.direction === "contextual") return { status: "context_only", difference, rankable: false };
  if (definition.direction === "unknown" || definition.comparisonPolicy === "not_rankable") {
    return { status: "not_rankable", difference, rankable: false };
  }
  if (difference === 0) return { status: "equal", difference, rankable: true };
  if (definition.direction === "adverse") {
    return { status: difference > 0 ? "adverse_signal" : "favorable_signal", difference, rankable: true };
  }
  return { status: difference < 0 ? "adverse_signal" : "favorable_signal", difference, rankable: true };
}

export function validateObservation(
  observation: MetricObservation,
  definition: MeasureDefinition,
  source: SourceVersion,
): ValidationResult {
  const errors: string[] = [];
  if (observation.measureDefinitionId !== definition.id) errors.push("Observation measure definition does not match.");
  if (observation.sourceVersionId !== source.id) errors.push("Observation source version does not match.");
  if (observation.confidenceLow !== null && observation.confidenceHigh !== null
    && observation.confidenceLow > observation.confidenceHigh) errors.push("Confidence interval lower bound exceeds upper bound.");
  if (observation.numericValue !== null && !Number.isFinite(observation.numericValue)) errors.push("Observation numeric value must be finite.");
  if (observation.numericValue === null && observation.value !== null && typeof observation.value === "number") {
    errors.push("Numeric observations must populate numericValue.");
  }
  if (observation.reviewStatus === "verified" && source.reviewStatus !== "verified") {
    errors.push("An observation cannot be verified when its source version is not verified.");
  }
  if (observation.dataPeriodStart && observation.dataPeriodEnd
    && (dateValue(observation.dataPeriodStart) ?? 0) > (dateValue(observation.dataPeriodEnd) ?? 0)) {
    errors.push("Observation data period start must not follow its end.");
  }
  return result(errors);
}

export function validateClaimCitations({
  claim,
  document,
  source,
  citations,
}: {
  claim: EvidenceClaim;
  document: PlanningDocument;
  source: SourceVersion;
  citations: EvidenceCitation[];
}): ValidationResult {
  const errors: string[] = [];
  if (claim.documentId !== document.id) errors.push("Claim document does not match.");
  if (document.sourceVersionId !== source.id) errors.push("Document source version does not match.");
  if (source.sourceId !== "local-planning-documents") errors.push("Planning claims require a local-planning-document source version.");
  const linked = citations.filter((citation) => citation.claimId === claim.id && citation.documentId === document.id);
  if (linked.length === 0) errors.push("Every planning-document claim requires at least one citation.");
  for (const citation of linked) {
    if (citation.sourceVersionId !== source.id) errors.push("Citation source version does not match the document source version.");
    if (citation.pageNumber === null && !citation.section?.trim()) errors.push("Document citations require a page number or section.");
    if (!citation.quotedText.trim()) errors.push("Citation requires quoted text.");
    if (citation.quotedText.trim() && !claim.exactExcerpt.includes(citation.quotedText)) {
      errors.push("Citation quoted text must be retained in the claim's exact excerpt.");
    }
    if (!isSha256(citation.quotedTextHash)) errors.push("Citation requires a SHA-256 hash of the quoted text.");
  }
  if (claim.reviewStatus === "verified") {
    if (document.reviewStatus !== "verified" || source.reviewStatus !== "verified") {
      errors.push("A verified claim requires a verified document and source version.");
    }
    if (!claim.reviewedBy || !claim.reviewedAt) errors.push("Verified claims require a named reviewer and review date.");
    if (linked.some((citation) => citation.reviewStatus !== "verified")) {
      errors.push("All citations for a verified claim must be verified.");
    }
  }
  return result(errors);
}

export function canPublishEvidence(status: ReviewStatus) {
  return status === "verified";
}
