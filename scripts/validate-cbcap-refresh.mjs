import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = process.env.CBCAP_ROOT ? path.resolve(process.env.CBCAP_ROOT) : SCRIPT_ROOT;
const DATA_DIR = path.join(ROOT, "apps", "platform", "data");
const PUBLIC_DATA_DIR = path.join(ROOT, "apps", "platform", "public", "data");
const EXPECTED_STATES = 51;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertHttps(value, label) {
  assert(typeof value === "string" && value.startsWith("https://"), `${label} must use HTTPS`);
}

function assertUniqueFips(values, expected, label) {
  assert(values.length === expected, `${label} must contain exactly ${expected.toLocaleString("en-US")} records`);
  assert(values.every((value) => /^\d{5}$/.test(value)), `${label} contains an invalid county FIPS value`);
  assert(new Set(values).size === expected, `${label} county FIPS values must be unique`);
}

async function readJson(file) {
  const text = await readFile(file, "utf8");
  return { text, value: JSON.parse(text) };
}

async function main() {
  const [
    countyData,
    sourceManifest,
    dashboardSummary,
    boundaryManifest,
    countyMap,
    boundaries,
  ] = await Promise.all([
    readJson(path.join(DATA_DIR, "county-planning.json")),
    readJson(path.join(DATA_DIR, "source-manifest.json")),
    readJson(path.join(DATA_DIR, "dashboard-summary.json")),
    readJson(path.join(DATA_DIR, "boundary-manifest.json")),
    readJson(path.join(PUBLIC_DATA_DIR, "cbcap-county-map-2025.json")),
    readJson(path.join(PUBLIC_DATA_DIR, "cbcap-boundaries-2025.json")),
  ]);

  const counties = countyData.value;
  assert(Array.isArray(counties), "County planning data must be an array");
  const expectedCounties = Number(sourceManifest.value.geography?.countyCount);
  assert(Number.isInteger(expectedCounties) && expectedCounties > 0, "Official geography manifest must declare a positive derived county count");
  const countyFips = counties.map((county) => String(county.fips ?? ""));
  assertUniqueFips(countyFips, expectedCounties, "County planning data");

  const calculatedSourceHash = sha256(countyData.text);
  const quality = sourceManifest.value.quality ?? {};
  assert(quality.expectedCountyEquivalents === expectedCounties, "Source manifest expected-county count differs from the official geography count");
  assert(quality.actualCountyEquivalents === expectedCounties, "Source manifest does not contain the official county universe");
  assert(quality.uniqueFips === expectedCounties, "Source manifest does not report the official number of unique county FIPS values");
  assert(quality.sha256 === calculatedSourceHash, "County planning data does not match its declared source hash");
  assert(sourceManifest.value.indicators?.matchedCountyCount >= 0, "Indicator coverage cannot be negative");
  assert(sourceManifest.value.indicators?.matchedCountyCount <= expectedCounties, "Indicator coverage exceeds the county universe");
  assertHttps(sourceManifest.value.geography?.url, "Geography source URL");
  assertHttps(sourceManifest.value.indicators?.url, "Indicator source URL");
  assert(Number.isFinite(Date.parse(sourceManifest.value.generatedAt)), "Source manifest generatedAt must be an ISO date");

  const stateFips = new Set(counties.map((county) => String(county.stateFips ?? "")));
  assert(stateFips.size === EXPECTED_STATES, "County planning data must cover 50 states and the District of Columbia");

  const map = countyMap.value;
  assert(map.version === 1, "County map schema version changed without review");
  assert(map.countyCount === expectedCounties, "County map count differs from the official county universe");
  assert(map.sourceHash === calculatedSourceHash, "County map source hash does not match county planning data");
  assert(Array.isArray(map.records), "County map records must be an array");
  const mapFips = map.records.map((record) => String(record?.[0] ?? ""));
  const mapFipsSet = new Set(mapFips);
  assertUniqueFips(mapFips, expectedCounties, "County map");
  assert(countyFips.every((fips) => mapFipsSet.has(fips)), "County map and planning data FIPS sets differ");

  const summary = dashboardSummary.value;
  assert(Array.isArray(summary.states) && summary.states.length === EXPECTED_STATES, "Dashboard summary must contain 51 state/DC records");
  assert(summary.coverage?.countyCount === expectedCounties, "Dashboard summary county count differs from the official county universe");
  assert(summary.coverage?.availableCountyCount === sourceManifest.value.indicators.matchedCountyCount, "Dashboard and source-manifest indicator coverage differ");
  assert(summary.sources?.quality?.sha256 === calculatedSourceHash, "Dashboard summary source hash does not match county planning data");

  const boundary = boundaries.value;
  assert(boundary.schemaVersion === 1, "Boundary schema version changed without review");
  assert(Array.isArray(boundary.counties), "County boundaries must be an array");
  assert(Array.isArray(boundary.states) && boundary.states.length === EXPECTED_STATES, "Boundary data must contain 51 state/DC geometries");
  const boundaryFips = boundary.counties.map((feature) => String(feature.id ?? ""));
  const boundaryFipsSet = new Set(boundaryFips);
  assertUniqueFips(boundaryFips, expectedCounties, "County boundaries");
  assert(countyFips.every((fips) => boundaryFipsSet.has(fips)), "Boundary and planning data FIPS sets differ");
  assert(boundaryManifest.value.countyCount === expectedCounties, "Boundary manifest county count differs from the official county universe");
  assert(boundaryManifest.value.stateCount === EXPECTED_STATES, "Boundary manifest state count changed");
  assert(boundaryManifest.value.sha256 === sha256(boundaries.text), "Boundary data does not match its declared source hash");
  assertHttps(boundaryManifest.value.sourceUrl, "Boundary source URL");

  const availableProfiles = counties.filter((county) => county.sourceStatus === "available").length;
  assert(availableProfiles === sourceManifest.value.indicators.matchedCountyCount, "Available profile count does not match the source manifest");

  console.log(JSON.stringify({
    countyEquivalents: countyFips.length,
    statesAndDistrict: stateFips.size,
    indicatorProfiles: availableProfiles,
    planningProfiles: quality.planningIndexAvailable,
    sourceHash: calculatedSourceHash,
    boundaryHash: boundaryManifest.value.sha256,
    generatedAt: sourceManifest.value.generatedAt,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "CB-CAP refresh validation failed");
  process.exitCode = 1;
});
