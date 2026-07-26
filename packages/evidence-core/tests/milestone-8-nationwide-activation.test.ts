import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import {
  buildCountyPlaceBrief,
  CdcPlacesIngestionAdapter,
  InMemoryHttpCache,
  validateExplorePlaceBriefV1,
  validateNationalGeographyCatalog,
  type CountyEvidenceSnapshot,
  type FetchLike,
  type Geography,
  type NationalGeographyCatalog,
} from "../src/index.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nationalDir = path.join(packageRoot, "data", "national");

async function artifacts() {
  const catalog = JSON.parse(gunzipSync(await readFile(path.join(nationalDir, "national-geography.v2025.json.gz"))).toString("utf8")) as NationalGeographyCatalog;
  const snapshot = JSON.parse(await readFile(path.join(nationalDir, "county-evidence-snapshot.v1.json"), "utf8")) as CountyEvidenceSnapshot;
  return { catalog, snapshot };
}

test("the official-vintage county universe is complete, unique, and searchable by name and GEOID", async () => {
  const { catalog, snapshot } = await artifacts();
  const validation = validateNationalGeographyCatalog(catalog);
  assert.equal(validation.valid, true);
  assert.equal(snapshot.counties.length, validation.authoritativePrimaryCountyCount);
  assert.equal(new Set(snapshot.counties.map((county) => county.fips)).size, validation.authoritativePrimaryCountyCount);
  assert.equal(validation.searchablePrimaryCountyCount, validation.authoritativePrimaryCountyCount);
  for (const county of snapshot.counties) {
    assert.match(county.fips, /^\d{5}$/);
    assert.ok(county.county.length > 0);
  }
});

test("every county returns a valid brief with a named status for every required source", async () => {
  const { snapshot } = await artifacts();
  const requiredSources = [
    "census-geography", "cdc-places", "census-acs5",
    "hrsa-workforce", "ahrq-clh", "local-planning-documents",
  ];
  for (const county of snapshot.counties) {
    const brief = buildCountyPlaceBrief(county, snapshot);
    const validation = validateExplorePlaceBriefV1(brief);
    assert.equal(validation.valid, true, `${county.fips}: ${validation.errors.join(" ")}`);
    assert.deepEqual(brief.publicData.sourceCoverage.map((item) => item.sourceId), requiredSources);
    assert.equal(brief.localPlanningEvidence.status, "not_yet_verified");
    assert.ok(brief.evidenceAssessment.requiresLocalReview.includes("Current local planning evidence: not yet verified."));
  }
});

test("ZCTAs remain distinct and official cross-county overlap is preserved", async () => {
  const { catalog } = await artifacts();
  const overlaps = catalog.relationships.filter((relationship) =>
    relationship.fromKind === "zcta" && relationship.relationship === "overlaps");
  const counts = new Map<string, number>();
  for (const relationship of overlaps) counts.set(relationship.fromGeoid, (counts.get(relationship.fromGeoid) ?? 0) + 1);
  assert.ok([...counts.values()].some((count) => count > 1));
  assert.ok(overlaps.every((relationship) => relationship.caveat?.includes("postal ZIP Code is not a ZCTA")));
});

test("Chester County current CDC rows are present when compatible measures are requested", async () => {
  const rows = [
    { year: "2022", locationid: "42029", locationname: "Chester", measureid: "COLON_SCREEN", measure: "Colorectal cancer screening", datavaluetypeid: "CrdPrv", data_value_type: "Crude prevalence", data_value_unit: "%", data_value: "71.8", low_confidence_limit: "67.1", high_confidence_limit: "76.1" },
    { year: "2022", locationid: "42029", locationname: "Chester", measureid: "DENTAL", measure: "Dental visit", datavaluetypeid: "CrdPrv", data_value_type: "Crude prevalence", data_value_unit: "%", data_value: "72.2", low_confidence_limit: "68.9", high_confidence_limit: "75.2" },
    { year: "2022", locationid: "42029", locationname: "Chester", measureid: "MAMMOUSE", measure: "Mammography use", datavaluetypeid: "CrdPrv", data_value_type: "Crude prevalence", data_value_unit: "%", data_value: "81.2", low_confidence_limit: "74.4", high_confidence_limit: "86.7" },
  ];
  const fetcher: FetchLike = async () => ({
    status: 200,
    ok: true,
    headers: { get: () => "application/json" },
    async text() { return JSON.stringify(rows); },
    async arrayBuffer() { return new TextEncoder().encode(JSON.stringify(rows)).buffer; },
  });
  const geography: Geography = {
    id: "county:42029",
    kind: "county",
    authority: "census",
    authorityId: "42029",
    name: "Chester County",
    displayName: "Chester County, PA",
    stateFips: "42",
    countyFips: "42029",
    vintage: "2025",
    validFrom: null,
    validTo: null,
    reviewStatus: "verified",
    caveat: null,
  };
  const adapter = new CdcPlacesIngestionAdapter({
    releaseLabel: "December 2025 release",
    releaseDate: "2025-12-04",
  });
  const batch = await adapter.fetch(
    { geography, requestedMeasureIds: ["COLON_SCREEN", "DENTAL", "MAMMOUSE"] },
    { fetcher, cache: new InMemoryHttpCache(), now: "2026-07-23T00:00:00Z" },
  );
  assert.equal(batch.observations.length, 3);
  assert.deepEqual([...new Set(batch.observations.map((item) => item.sourceMetadata.measureId))].sort(), ["COLON_SCREEN", "DENTAL", "MAMMOUSE"]);
  assert.ok(batch.observations.every((item) => item.sourceMetadata.datasetId === "swc5-untb"));
  assert.equal(batch.measures.find((measure) => measure.sourceMeasureId.startsWith("COLON_SCREEN"))?.higherValueMeaning, "favorable");
});

test("legacy public Explore source contains no upstream evidence request", async () => {
  const route = await readFile(path.resolve(packageRoot, "..", "..", "apps", "public-site", "app", "api", "explore", "route.ts"), "utf8");
  assert.doesNotMatch(route, /data\.cdc\.gov|api\.census\.gov|fetch\s*\(/);
  assert.match(route, /getApprovedCountyBrief/);
});
