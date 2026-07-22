import assert from "node:assert/strict";
import test from "node:test";
import {
  interpretMetricComparison,
  parseCountyFips,
  resolvePlace,
  sourceCatalogById,
  validateAdapterRequest,
  validateClaimCitations,
  validateGeographyCatalog,
  validateSourceVersion,
  type EvidenceCitation,
  type EvidenceClaim,
  type Geography,
  type GeographyCatalog,
  type GeographyRelationship,
  type MeasureDefinition,
  type PlanningDocument,
  type SourceVersion,
} from "../src/index.ts";

const HASH = `sha256:${"a".repeat(64)}`;

function geography(
  id: string,
  kind: Geography["kind"],
  authorityId: string,
  displayName: string,
  stateFips: string | null,
): Geography {
  return {
    id,
    kind,
    authority: kind === "postal_zip" ? "usps" : "census",
    authorityId,
    name: displayName,
    displayName,
    stateFips,
    countyFips: kind === "county" ? authorityId : null,
    vintage: "synthetic-test-vintage",
    validFrom: null,
    validTo: null,
    reviewStatus: "verified",
    caveat: null,
  };
}

const zcta = geography("geo-zcta", "zcta", "12345", "ZCTA 12345", null);
const countyA = geography("geo-county-a", "county", "36093", "Schenectady County, NY", "36");
const countyB = geography("geo-county-b", "county", "36057", "Montgomery County, NY", "36");

function overlap(id: string, countyId: string, area: number): GeographyRelationship {
  return {
    id,
    fromGeographyId: zcta.id,
    toGeographyId: countyId,
    kind: "overlaps",
    sourceVersionId: "source-census-test",
    vintage: "synthetic-test-vintage",
    overlapAreaPercent: area,
    overlapPopulationPercent: null,
    method: "Synthetic relationship fixture used only to test multi-county handling.",
    caveat: null,
    reviewStatus: "verified",
  };
}

const catalog: GeographyCatalog = {
  geographies: [zcta, countyA, countyB],
  aliases: [],
  relationships: [overlap("rel-a", countyA.id, 60), overlap("rel-b", countyB.id, 40)],
};

test("keeps ZIP input distinct from the Census ZCTA used for statistical evidence", () => {
  const result = resolvePlace({ raw: "12345", kind: "zip_input" }, catalog);
  assert.equal(result.status, "resolved");
  assert.equal(result.query.kind, "zip_input");
  assert.equal(result.selected?.kind, "zcta");
  assert.equal(result.evidenceGeography?.kind, "zcta");
  assert.ok(result.caveats.some((caveat) => /not a USPS delivery route/i.test(caveat)));
});

test("discloses every reviewed county overlap instead of choosing a centroid county", () => {
  const result = resolvePlace({ raw: "12345", kind: "zcta" }, catalog);
  const countyOverlaps = result.relationships.filter((relationship) => relationship.kind === "overlaps");
  assert.equal(countyOverlaps.length, 2);
  assert.deepEqual(countyOverlaps.map((relationship) => relationship.overlapAreaPercent), [60, 40]);
  assert.ok(result.caveats.some((caveat) => /overlaps 2 counties/i.test(caveat)));
  assert.equal(validateGeographyCatalog(catalog).valid, true);
  const invalid = validateGeographyCatalog({
    ...catalog,
    relationships: [overlap("rel-a", countyA.id, 80), overlap("rel-b", countyB.id, 40)],
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => /exceed 100 percent/i.test(error)));
});

test("validates county FIPS as a state FIPS plus three-digit county code", () => {
  assert.deepEqual(parseCountyFips("36001"), { fips: "36001", stateFips: "36", countyCode: "001" });
  assert.deepEqual(parseCountyFips("48029"), { fips: "48029", stateFips: "48", countyCode: "029" });
  assert.equal(parseCountyFips("36000"), null);
  assert.equal(parseCountyFips("99001"), null);
  assert.equal(parseCountyFips("36A01"), null);
});

const adverse: MeasureDefinition = {
  id: "measure-diabetes",
  sourceMeasureId: "DIABETES",
  name: "Diagnosed diabetes",
  description: "Modeled prevalence among adults.",
  direction: "adverse",
  higherValueMeaning: "adverse",
  unit: "percent",
  universe: "Adults age 18 years and older",
  adjustment: "modeled",
  comparisonPolicy: "higher_is_concern",
  reviewStatus: "verified",
};

const protective: MeasureDefinition = {
  ...adverse,
  id: "measure-screening",
  sourceMeasureId: "SCREENING",
  name: "Recommended screening use",
  direction: "protective",
  higherValueMeaning: "favorable",
  comparisonPolicy: "lower_is_concern",
};

test("does not rank a positive measure as a problem merely because its value is high", () => {
  assert.equal(interpretMetricComparison(adverse, 14, 10).status, "adverse_signal");
  assert.equal(interpretMetricComparison(protective, 80, 70).status, "favorable_signal");
  assert.equal(interpretMetricComparison(protective, 60, 70).status, "adverse_signal");
  assert.equal(
    interpretMetricComparison({ ...protective, direction: "contextual", higherValueMeaning: "context_dependent", comparisonPolicy: "context_only" }, 80, 70).rankable,
    false,
  );
});

const sourceVersion: SourceVersion = {
  id: "source-version-1",
  sourceId: "cdc-places",
  releaseLabel: "2025 release",
  releaseDate: "2025-12-04",
  dataPeriodStart: "2022-01-01",
  dataPeriodEnd: "2023-12-31",
  retrievedAt: "2026-07-20T12:00:00Z",
  staleAfter: "2026-12-31T23:59:59Z",
  officialUrl: "https://www.cdc.gov/places/",
  contentHash: HASH,
  schemaVersion: "cdc-places.v1",
  reviewStatus: "verified",
  reviewedBy: "reviewer@example.org",
  reviewedAt: "2026-07-20T13:00:00Z",
};

test("requires an approved host, freshness window, content hash, and reviewer for verified sources", () => {
  const source = sourceCatalogById("cdc-places");
  assert.ok(source);
  assert.equal(validateSourceVersion(sourceVersion, source, "2026-07-20T14:00:00Z").valid, true);
  const stale = validateSourceVersion(
    { ...sourceVersion, staleAfter: "2026-01-01T00:00:00Z" },
    source,
    "2026-07-20T14:00:00Z",
  );
  assert.equal(stale.valid, false);
  assert.ok(stale.errors.some((error) => /stale-after/i.test(error)));
});

test("blocks non-official adapter hosts", () => {
  const source = sourceCatalogById("census-geography");
  assert.ok(source);
  assert.equal(validateAdapterRequest({
    url: "https://www2.census.gov/geo/tiger/",
    method: "GET",
    purpose: "Reviewed Census release artifact.",
    expectedMediaTypes: ["application/zip"],
  }, source).valid, true);
  assert.equal(validateAdapterRequest({
    url: "https://github.com/example/zip-boundaries.zip",
    method: "GET",
    purpose: "Unapproved boundary file.",
    expectedMediaTypes: ["application/zip"],
  }, source).valid, false);
});

const document: PlanningDocument = {
  id: "document-1",
  sourceVersionId: "planning-source-version-1",
  documentType: "chip",
  title: "Verified local plan fixture",
  publisher: "Test health department",
  officialUrl: "https://example.gov/plan.pdf",
  publishedAt: "2026-01-01",
  periodStart: "2026-01-01",
  periodEnd: "2030-12-31",
  geographyIds: [countyA.id],
  contentHash: HASH,
  pageCount: 100,
  coverageScope: "county_specific",
  currentPlanStatus: "verified_current",
  reviewStatus: "verified",
  reviewedBy: "reviewer@example.org",
  reviewedAt: "2026-07-20T13:00:00Z",
};

const planningSourceVersion: SourceVersion = {
  ...sourceVersion,
  id: document.sourceVersionId,
  sourceId: "local-planning-documents",
  releaseLabel: "Verified local plan fixture",
  officialUrl: document.officialUrl,
};

const claim: EvidenceClaim = {
  id: "claim-1",
  documentId: document.id,
  geographyIds: [countyA.id],
  claimType: "priority",
  statement: "The local plan names a reviewed priority.",
  exactExcerpt: "Synthetic excerpt used only for contract testing.",
  extractionMethod: "human",
  confidence: "high",
  reviewStatus: "verified",
  reviewedBy: "reviewer@example.org",
  reviewedAt: "2026-07-20T13:00:00Z",
};

const citation: EvidenceCitation = {
  id: "citation-1",
  claimId: claim.id,
  documentId: document.id,
  sourceVersionId: planningSourceVersion.id,
  pageNumber: 12,
  artifactPageIndex: 11,
  section: "Priority setting",
  paragraph: null,
  sourceField: null,
  quotedText: claim.exactExcerpt,
  quotedTextHash: HASH,
  locatorBoundingBox: null,
  reviewStatus: "verified",
};

test("requires page or section citations for verified local planning claims", () => {
  const valid = validateClaimCitations({ claim, document, source: planningSourceVersion, citations: [citation] });
  assert.equal(valid.valid, true);
  const invalid = validateClaimCitations({
    claim,
    document,
    source: planningSourceVersion,
    citations: [{ ...citation, pageNumber: null, section: null }],
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => /page number or section/i.test(error)));
});
