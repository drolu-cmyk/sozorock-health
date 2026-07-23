import type {
  ClaimPublicationCheckInput,
  PrioritySignal,
  PublicationCheckInput,
  PublicEvidenceEligibility,
  SourceFreshnessAssessment,
} from "./types.ts";

const DAY_MS = 86_400_000;

export const PLACE_EVIDENCE_OPERATING_POLICY_VERSION =
  "place-evidence-operations.v1" as const;

export const FUNDER_DECISION_STANDARD = {
  geography: [
    "Prefer the most local valid geography and name its exact Census or source grain.",
    "Never present county, city, tract, ZCTA, ZIP, planning-region, or facility evidence as interchangeable.",
    "Disclose ZIP-to-ZCTA approximation and cross-county overlap when it affects interpretation.",
  ],
  evidence: [
    "Lead with three to five verified adverse signals, not every available measure.",
    "Separate verified local-plan priorities from modeled public-data context.",
    "Show publisher, source URL, release date, data period, retrieval date, geography, and limitations.",
    "Treat missing, suppressed, unavailable, and stale evidence as distinct states; none of these states means zero.",
  ],
  action: [
    "Use the sequence evidence to practical barrier to possible non-clinical response to partner role to measurable progress.",
    "Allow insufficient evidence and local review required as valid outcomes.",
    "Do not recommend a SozoRock response from modeled population data alone.",
  ],
  equity: [
    "Describe disparities only when a reviewed source explicitly supports the population, geography, and period.",
    "Do not infer race, ethnicity, disability, income, rurality, or individual risk from area-level estimates.",
  ],
  delivery: [
    "Pair maps with plain-language comparisons, source dates, definitions, and a low-bandwidth alternative.",
    "Keep outputs cited, editable, exportable, reproducible, non-clinical, and ready for human review.",
  ],
} as const;

function parseDate(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ISO date: ${value}`);
  return parsed;
}

export function assessSourceFreshness({
  lastSuccessfulImportAt,
  staleAfterDays,
  now,
}: {
  lastSuccessfulImportAt: string | null;
  staleAfterDays: number;
  now: string;
}): SourceFreshnessAssessment {
  if (!lastSuccessfulImportAt) {
    return {
      status: "unavailable",
      ageDays: null,
      staleAfterDays,
      label: "No successful import",
    };
  }

  const ageDays = Math.max(
    0,
    Math.floor((parseDate(now) - parseDate(lastSuccessfulImportAt)) / DAY_MS),
  );
  return ageDays > staleAfterDays
    ? { status: "stale", ageDays, staleAfterDays, label: `Stale by ${ageDays - staleAfterDays} day(s)` }
    : { status: "current", ageDays, staleAfterDays, label: "Current" };
}

export function assessObservationForPublicUse(
  input: PublicationCheckInput,
): PublicEvidenceEligibility {
  const reasons: string[] = [];
  const { observation, measure, selectedGeography, sourceVersion, now } = input;

  if (observation.reviewStatus !== "verified") reasons.push("Observation is not verified.");
  if (measure.reviewStatus !== "verified") reasons.push("Measure definition is not verified.");
  if (sourceVersion.reviewStatus !== "verified") reasons.push("Source version is not verified.");
  if (observation.geographyId !== selectedGeography.id) {
    reasons.push("Observation does not match the selected geography.");
  }
  if (observation.geographyLevel !== selectedGeography.kind) {
    reasons.push("Observation geography level does not match the selected geography kind.");
  }
  if (!observation.sourceUrl || !observation.sourceRecordId) {
    reasons.push("Source URL or original source record identifier is missing.");
  }
  if (!observation.releaseDate || !observation.retrievedAt) {
    reasons.push("Release or retrieval date is missing.");
  }
  if (Date.parse(sourceVersion.staleAfter) < Date.parse(now)) {
    reasons.push("Source version is stale.");
  }

  return { eligible: reasons.length === 0, reasons };
}

export function assessClaimForPublicUse(
  input: ClaimPublicationCheckInput,
): PublicEvidenceEligibility {
  const reasons: string[] = [];
  if (input.claim.reviewStatus !== "verified") reasons.push("Planning claim is not verified.");
  if (input.claim.confidence !== "high") reasons.push("Planning claim is not high confidence.");
  const matchingCitations = input.citations.filter(
    (citation) => citation.claimId === input.claim.id,
  );
  if (matchingCitations.length === 0) reasons.push("Planning claim has no citation.");
  if (matchingCitations.some((citation) => citation.reviewStatus !== "verified")) {
    reasons.push("At least one citation is not verified.");
  }
  if (
    matchingCitations.some(
      (citation) => citation.pageNumber === null && citation.section === null,
    )
  ) {
    reasons.push("Citation requires a page or section locator.");
  }
  return { eligible: reasons.length === 0, reasons };
}

export function selectPrioritySignals({
  observations,
  measures,
  selectedGeographyId,
  maximum = 5,
}: {
  observations: PublicationCheckInput["observation"][];
  measures: PublicationCheckInput["measure"][];
  selectedGeographyId: string;
  maximum?: number;
}): PrioritySignal[] {
  const measureById = new Map(measures.map((measure) => [measure.id, measure]));
  return observations
    .flatMap((observation): PrioritySignal[] => {
      const measure = measureById.get(observation.measureDefinitionId);
      if (
        observation.geographyId !== selectedGeographyId ||
        observation.reviewStatus !== "verified" ||
        observation.numericValue === null ||
        !measure ||
        measure.reviewStatus !== "verified" ||
        measure.higherValueMeaning !== "adverse" ||
        measure.comparisonPolicy !== "higher_is_concern"
      ) {
        return [];
      }
      return [{
        observation,
        measure,
        magnitude: Math.abs(observation.numericValue),
      }];
    })
    .sort((left, right) => right.magnitude - left.magnitude)
    .slice(0, Math.max(0, Math.min(maximum, 5)));
}
