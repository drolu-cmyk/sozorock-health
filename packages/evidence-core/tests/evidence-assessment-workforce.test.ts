import assert from "node:assert/strict";
import test from "node:test";
import { recomputeEvidenceAssessment } from "../src/national/county-brief.ts";
import type { ExplorePlaceBriefV1, ExploreSourceCoverage } from "../src/explore-contract.ts";

function coverage(
  sourceId: ExploreSourceCoverage["sourceId"],
  status: ExploreSourceCoverage["status"],
  observationCount: number,
): ExploreSourceCoverage {
  return {
    sourceId,
    status,
    reason: `${sourceId} ${status}`,
    sourceVersionId: ["available", "partially_available"].includes(status) ? `version:${sourceId}` : null,
    geographyKind: sourceId === "hrsa-workforce" ? "source_designation" : "county",
    observationCount,
    releaseDate: "2026-01-01",
    dataPeriod: { start: "2024-01-01", end: "2024-12-31" },
    retrievedAt: "2026-02-01",
  };
}

function brief(
  sourceCoverage: ExploreSourceCoverage[],
  ahrfObservationCount = 0,
): ExplorePlaceBriefV1 {
  const ahrfVersion = "version:ahrf-workforce";
  return {
    contractVersion: "explore.place-brief.v1",
    generatedAt: "2026-08-01",
    evidenceSnapshotId: `snapshot:${"a".repeat(64)}`,
    policyVersion: "policy.v1",
    query: { raw: "17031", kind: "county_fips" },
    resolution: {
      status: "resolved",
      selected: { id: "g", kind: "county", authority: "census", authorityId: "17031", displayName: "Cook County, IL", vintage: "2025", reviewStatus: "verified" },
      evidenceGeographies: [], overlappingCounties: [], caveats: [],
    },
    localPlanningEvidence: { status: "not_yet_verified", documents: [], claims: [] },
    publicData: {
      observations: Array.from({ length: ahrfObservationCount }, (_, index) => ({
        id: `ahrf-${index + 1}`,
        measureDefinitionId: `ahrf-measure-${index + 1}`,
        label: `AHRF workforce measure ${index + 1}`,
        direction: "contextual" as const,
        unit: "count",
        universe: "County workforce and facility context",
        adjustment: "none",
        value: index + 1,
        confidence: { low: null, high: null, marginOfError: null },
        geographyId: "g",
        sourceVersionId: ahrfVersion,
        releaseDate: "2026-01-01",
        dataPeriod: { start: "2024-01-01", end: "2024-12-31" },
        reviewStatus: "verified" as const,
        interpretation: "context_only" as const,
        benchmarkObservationId: null,
        citationIds: [`ahrf-citation-${index + 1}`],
      })),
      sources: ahrfObservationCount ? [{
        sourceId: "ahrf-workforce",
        sourceVersionId: ahrfVersion,
        publisher: "Health Resources and Services Administration, Bureau of Health Workforce",
        title: "Area Health Resources Files",
        officialUrl: "https://data.hrsa.gov/topics/health-workforce/ahrf",
        releaseDate: "2026-01-01",
        dataPeriod: { start: "2024-01-01", end: "2024-12-31" },
        retrievedAt: "2026-02-01",
        reviewStatus: "verified",
      }] : [],
      sourceCoverage,
    },
    evidenceAssessment: { known: [], missing: [], requiresLocalReview: [], responseFits: [] },
    citations: [],
    safety: { classification: "non_clinical_place_evidence", containsPhi: false, limitations: [] },
  };
}

test("available HRSA and AHRF evidence is not reported as missing", () => {
  const result = recomputeEvidenceAssessment(brief([
    coverage("hrsa-workforce", "available", 245),
    coverage("ahrf-workforce", "available", 7),
  ], 7), Array.from({ length: 245 }, (_, index) => ({
    wholeCounty: index < 2,
    designationId: `hrsa-${index + 1}`,
    designationName: `HRSA designation ${index + 1}`,
    designationType: index < 2 ? "Geographic" : "Facility or population group",
    sourceId: "hrsa-workforce",
    sourceVersionId: "version:hrsa-workforce",
    releaseDate: "2026-01-01",
    dataPeriod: { start: "2024-01-01", end: "2024-12-31" },
    officialUrl: "https://data.hrsa.gov",
  })));
  assert.equal(result.workforce?.hrsa.recordCount, 245);
  assert.equal(result.workforce?.hrsa.wholeCountyRecordCount, 2);
  assert.equal(result.workforce?.ahrf.recordCount, 7);
  assert.equal(result.missing.some((item) => /hrsa-workforce|ahrf-workforce/.test(item)), false);
  const fit = result.responseFits.find((candidate) => candidate.response === "workforce_conversation");
  assert.equal(fit?.status, "fit_for_local_review");
  assert.equal(fit?.missingEvidence.includes("Compatible workforce evidence"), false);
  assert.equal(fit?.evidenceIds.length, 252);
  assert.ok(fit?.evidenceIds.some((id) => id.startsWith("workforce:")));
  assert.ok(fit?.evidenceIds.some((id) => id.startsWith("workforce-observation:")));
  assert.equal(result.references?.filter((reference) => reference.evidenceType === "workforce_designation").length, 245);
  assert.equal(result.references?.filter((reference) => reference.evidenceType === "metric_observation").length, 7);
});

test("scoped HRSA records retain their scope and require local review", () => {
  const result = recomputeEvidenceAssessment(brief([
    coverage("hrsa-workforce", "available", 4),
    coverage("ahrf-workforce", "unavailable_from_source", 0),
  ]), Array.from({ length: 4 }, () => ({ wholeCounty: false })));
  assert.equal(result.workforce?.hrsa.scope, "scoped_records_available");
  assert.match(result.workforce?.interpretation ?? "", /subcounty, population-group, facility/i);
});

test("available source with no county records is distinct from source unavailable", () => {
  const noRecords = recomputeEvidenceAssessment(brief([
    coverage("hrsa-workforce", "available", 0),
    coverage("ahrf-workforce", "unavailable_from_source", 0),
  ]));
  assert.equal(noRecords.workforce?.hrsa.scope, "source_available_no_county_records");
  const unavailable = recomputeEvidenceAssessment(brief([
    coverage("hrsa-workforce", "unavailable_from_source", 0),
    coverage("ahrf-workforce", "unavailable_from_source", 0),
  ]));
  assert.equal(unavailable.workforce?.hrsa.scope, "source_unavailable");
});
