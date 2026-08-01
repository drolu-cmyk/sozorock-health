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

test("the public search and county-boundary artifacts cover the complete primary release scope", async () => {
  const search = JSON.parse(
    await readFile(path.join(nationalDir, "geography-search-index.v1.json"), "utf8"),
  ) as {
    censusVintage: string;
    counts: { county: number; place: number; zip: number };
    records: Array<{ kind: string; geoid: string; label: string }>;
  };
  const boundaries = JSON.parse(
    await readFile(path.join(nationalDir, "county-boundaries.v2025.json"), "utf8"),
  ) as {
    censusVintage: string;
    byGeoid: Record<string, { type: string; geometry: unknown }>;
    requests: Array<{ stateFips: string; sha256: string; featureCount: number }>;
  };
  assert.equal(search.censusVintage, "2025");
  assert.deepEqual(search.counts, { county: 3_144, place: 32_058, zip: 33_354 });
  assert.equal(search.records.length, 68_556);
  assert.equal(new Set(search.records.map((record) => `${record.kind}:${record.geoid}`)).size, 68_556);
  assert.equal(boundaries.censusVintage, "2025");
  assert.equal(Object.keys(boundaries.byGeoid).length, 3_144);
  assert.equal(boundaries.requests.length, 51);
  assert.ok(boundaries.requests.every((request) =>
    request.featureCount > 0 && /^[a-f0-9]{64}$/.test(request.sha256)));
  assert.ok(Object.values(boundaries.byGeoid).every((feature) => feature.type === "Feature" && feature.geometry));
});

test("every county returns a valid brief with a named status for every required source", async () => {
  const { snapshot } = await artifacts();
  const requiredSources = [
    "census-geography", "cdc-places", "census-acs5",
    "hrsa-workforce", "ahrf-workforce", "ahrq-clh", "local-planning-documents",
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

test("the public county-resolution index preserves every primary-scope ZCTA relationship", async () => {
  const { catalog } = await artifacts();
  const index = JSON.parse(
    await readFile(path.join(nationalDir, "county-resolution-index.v1.json"), "utf8"),
  ) as {
    zctas: Record<string, Array<{ countyGeoid: string; overlapAreaPercent: number | null }>>;
    caveat: string;
  };
  const primaryCounties = new Set(catalog.geographies
    .filter((record) => record.kind === "county" && record.releaseScope === "primary_50_states_dc")
    .map((record) => record.geoid));
  const expected = catalog.relationships.filter((relationship) =>
    relationship.fromKind === "zcta"
    && relationship.toKind === "county"
    && primaryCounties.has(relationship.toGeoid));
  const actual = Object.values(index.zctas).flat();
  assert.equal(actual.length, expected.length);
  assert.ok(actual.every((relationship) => primaryCounties.has(relationship.countyGeoid)));
  assert.ok(actual.every((relationship) =>
    relationship.overlapAreaPercent === null
    || relationship.overlapAreaPercent >= 0 && relationship.overlapAreaPercent <= 100));
  assert.match(index.caveat, /postal ZIP Code is not a Census ZCTA/);
});

test("the 2025 block-derived resolution index covers every current place and ZCTA", async () => {
  const { catalog } = await artifacts();
  const index = JSON.parse(
    await readFile(path.join(nationalDir, "county-resolution-index.v2.json"), "utf8"),
  ) as {
    censusVintage: string;
    source: { manifests: Array<{ stateFips: string; rows: number; sha256: string }> };
    places: Record<string, Array<{ countyGeoid: string; overlapAreaPercent: number | null }>>;
    zctas: Record<string, Array<{ countyGeoid: string; overlapAreaPercent: number | null }>>;
  };
  const places = catalog.geographies.filter((record) =>
    record.kind === "census_place" && record.releaseScope === "primary_50_states_dc");
  const zctas = catalog.geographies.filter((record) =>
    record.kind === "zcta" && record.releaseScope === "primary_50_states_dc");
  assert.equal(index.censusVintage, "2025");
  assert.equal(index.source.manifests.length, 51);
  assert.ok(index.source.manifests.every((manifest) => manifest.rows > 0 && /^[a-f0-9]{64}$/.test(manifest.sha256)));
  assert.equal(Object.keys(index.places).length, places.length);
  assert.equal(Object.keys(index.zctas).length, zctas.length);
  assert.ok(places.every((place) => index.places[place.geoid]?.length > 0));
  assert.ok(zctas.every((zcta) => index.zctas[zcta.geoid]?.length > 0));
  for (const relationships of [...Object.values(index.places), ...Object.values(index.zctas)]) {
    assert.ok(relationships.every((relationship) =>
      relationship.overlapAreaPercent !== null
      && relationship.overlapAreaPercent >= 0
      && relationship.overlapAreaPercent <= 100));
  }
});

test("the approved HRSA snapshot retains designation scope for all counties", async () => {
  const { snapshot } = await artifacts();
  const hrsa = JSON.parse(
    await readFile(path.join(nationalDir, "hrsa-county-context.v1.json"), "utf8"),
  ) as {
    countyCount: number;
    manifests: Array<{ rowCount: number; sha256: string }>;
    counties: Record<string, {
      hpsa: Array<{ wholeCounty: boolean; componentType: string; discipline: string; status: string }>;
      muaP: Array<{ wholeCounty: boolean; componentType: string; status: string }>;
    }>;
  };
  assert.equal(hrsa.countyCount, snapshot.counties.length);
  assert.ok(hrsa.manifests.every((manifest) => manifest.rowCount > 0 && /^[a-f0-9]{64}$/.test(manifest.sha256)));
  assert.ok(snapshot.counties.every((county) => county.fips in hrsa.counties));
  assert.ok(Object.values(hrsa.counties).some((county) => county.hpsa.some((designation) => !designation.wholeCounty)));
  assert.ok(Object.values(hrsa.counties).some((county) => county.muaP.some((designation) => !designation.wholeCounty)));
});

test("the approved AHRF snapshot validates its variables against official technical documentation", async () => {
  const { snapshot } = await artifacts();
  const ahrf = JSON.parse(
    await readFile(path.join(nationalDir, "ahrf-county-context.v1.json"), "utf8"),
  ) as {
    countyCount: number;
    releaseDate: string;
    approvedVariables: Array<{ id: string; year: string; direction: string }>;
    manifests: { data: { sha256: string }; documentation: { sha256: string } };
    counties: Record<string, { observations: Array<{ variableId: string; value: number | null }> }>;
  };
  assert.equal(ahrf.countyCount, snapshot.counties.length);
  assert.equal(ahrf.releaseDate, "2025-12-18");
  assert.ok(ahrf.approvedVariables.every((variable) => variable.direction === "context-dependent"));
  assert.match(ahrf.manifests.data.sha256, /^[a-f0-9]{64}$/);
  assert.match(ahrf.manifests.documentation.sha256, /^[a-f0-9]{64}$/);
  assert.ok(snapshot.counties.every((county) =>
    ahrf.counties[county.fips]?.observations.length === ahrf.approvedVariables.length));
});

test("the official ACS Summary File snapshot covers every county and retains margins of error", async () => {
  const { snapshot } = await artifacts();
  const acs = JSON.parse(
    await readFile(path.join(nationalDir, "acs-county-context.v1.json"), "utf8"),
  ) as {
    countyCount: number;
    source: { releaseDate: string; dataPeriod: { start: string; end: string }; format: string };
    sourceArtifacts: Array<{ tableId: string; sha256: string; countyRowCount: number }>;
    records: Record<string, {
      population: number | null;
      medianAgeMoe: number | null;
      povertyPercentMoe: number | null;
      noVehiclePercentMoe: number | null;
      internetSubscriptionPercentMoe: number | null;
    }>;
  };
  assert.equal(acs.countyCount, snapshot.counties.length);
  assert.equal(acs.source.releaseDate, "2026-01-29");
  assert.deepEqual(acs.source.dataPeriod, { start: "2020-01-01", end: "2024-12-31" });
  assert.equal(acs.source.format, "Table-Based ACS Summary File");
  assert.deepEqual(acs.sourceArtifacts.map((artifact) => artifact.tableId), [
    "B01001", "B01002", "B17001", "B08201", "B28002",
  ]);
  assert.ok(acs.sourceArtifacts.every((artifact) =>
    artifact.countyRowCount === snapshot.counties.length && /^[a-f0-9]{64}$/.test(artifact.sha256)));
  assert.ok(snapshot.counties.every((county) => county.fips in acs.records));
  assert.ok(acs.records["36001"].population !== null);
  assert.ok(acs.records["36001"].povertyPercentMoe !== null);
});

test("the approved AHRQ CLH snapshot is codebook matched and county complete", async () => {
  const { snapshot } = await artifacts();
  const ahrq = JSON.parse(
    await readFile(path.join(nationalDir, "ahrq-clh-county-context.v1.json"), "utf8"),
  ) as {
    countyCount: number;
    releaseDate: string;
    fileYear: string;
    approvedVariables: Array<{ id: string; label: string; originalSource: string; direction: string }>;
    manifests: { data: { sha256: string }; codebook: { sha256: string } };
    counties: Record<string, {
      observations: Array<{ variableId: string; value: string | number | null; uncertainty: null }>;
    }>;
  };
  assert.equal(ahrq.countyCount, snapshot.counties.length);
  assert.equal(ahrq.releaseDate, "2025-09-01");
  assert.equal(ahrq.fileYear, "2023");
  assert.equal(ahrq.approvedVariables.length, 7);
  assert.ok(ahrq.approvedVariables.every((variable) =>
    variable.label.length > 0 && variable.originalSource.length > 0 && variable.direction.length > 0));
  assert.match(ahrq.manifests.data.sha256, /^[a-f0-9]{64}$/);
  assert.match(ahrq.manifests.codebook.sha256, /^[a-f0-9]{64}$/);
  assert.ok(snapshot.counties.every((county) =>
    ahrq.counties[county.fips]?.observations.length === ahrq.approvedVariables.length));
  assert.ok(Object.values(ahrq.counties).every((county) =>
    county.observations.every((observation) => observation.uncertainty === null)));
});

test("local-document discovery, verification, and publication coverage are tracked separately for every county", async () => {
  const { catalog } = await artifacts();
  const directory = JSON.parse(
    await readFile(path.join(nationalDir, "local-plan-coverage-directory.v1.json"), "utf8"),
  ) as {
    countyCount: number;
    counties: Array<{
      countyGeoid: string;
      discoveryStatus: string;
      verificationStatus: string;
      publicationCoverageStatus: string;
      nextDiscoveryCheck: string;
    }>;
  };
  const validation = validateNationalGeographyCatalog(catalog);
  assert.equal(directory.countyCount, validation.authoritativePrimaryCountyCount);
  assert.equal(new Set(directory.counties.map((county) => county.countyGeoid)).size, directory.countyCount);
  assert.ok(directory.counties.every((county) => county.discoveryStatus.length > 0));
  assert.ok(directory.counties.every((county) => county.verificationStatus.length > 0));
  assert.ok(directory.counties.every((county) => county.publicationCoverageStatus.length > 0));
  assert.ok(directory.counties.every((county) => county.nextDiscoveryCheck === "monthly"));
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
  assert.match(route, /getPublishedCountyBrief/);
  assert.match(route, /getPublishedCountyRecord/);
});
