import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCountyPlaceBrief, type CountyEvidenceSnapshot, validateExplorePlaceBriefV1 } from "../src/index.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const nationalDir = path.join(packageRoot, "data", "national");
const countyRows = JSON.parse(await readFile(path.join(repoRoot, "apps", "platform", "data", "county-planning.json"), "utf8"));
const sourceManifest = JSON.parse(await readFile(path.join(repoRoot, "apps", "platform", "data", "source-manifest.json"), "utf8"));
const geographyCoverage = JSON.parse(await readFile(path.join(nationalDir, "national-geography-coverage.v2025.json"), "utf8"));
const acsContext = JSON.parse(await readFile(path.join(nationalDir, "acs-county-context.v1.json"), "utf8"));
const hrsaContext = JSON.parse(await readFile(path.join(nationalDir, "hrsa-county-context.v1.json"), "utf8"));
const ahrfContext = JSON.parse(await readFile(path.join(nationalDir, "ahrf-county-context.v1.json"), "utf8"));
const ahrqContext = JSON.parse(await readFile(path.join(nationalDir, "ahrq-clh-county-context.v1.json"), "utf8"));
const localPlanDirectory = JSON.parse(await readFile(path.join(nationalDir, "local-plan-coverage-directory.v1.json"), "utf8"));
const generatedAt = process.env.NATIONAL_SNAPSHOT_DATE?.trim() || new Date().toISOString();
const snapshotId = `snapshot:${createHash("sha256")
  .update(`${sourceManifest.quality.sha256}|${geographyCoverage.authoritativePrimaryCountyCount}|${generatedAt}`)
  .digest("hex")}`;

const snapshot: CountyEvidenceSnapshot = {
  schemaVersion: "sozorock.county-evidence-snapshot.v1",
  snapshotId,
  generatedAt,
  policyVersion: "place-evidence-policy.v1",
  censusVintage: String(geographyCoverage.counts ? "2025" : sourceManifest.geography.vintage),
  cdc: {
    datasetId: sourceManifest.indicators.datasetId,
    officialUrl: sourceManifest.indicators.url,
    releaseDate: "2025-12-04",
    dataPeriodStart: "2022-01-01",
    dataPeriodEnd: "2023-12-31",
    retrievedAt: sourceManifest.generatedAt,
  },
  counties: countyRows,
};

const countyGeoids = new Set(snapshot.counties.map((county) => county.fips));
const failures = [];
const sourceCoverageCounts: Record<string, Record<string, number>> = {};
for (const county of snapshot.counties) {
  const validation = validateExplorePlaceBriefV1(buildCountyPlaceBrief(county, snapshot));
  if (!validation.valid) failures.push({ geoid: county.fips, errors: validation.errors });
}
const localPlans = new Map(localPlanDirectory.counties.map((item: { countyGeoid: string }) => [item.countyGeoid, item]));
function addCoverage(sourceId: string, status: string) {
  sourceCoverageCounts[sourceId] ??= {};
  sourceCoverageCounts[sourceId][status] = (sourceCoverageCounts[sourceId][status] ?? 0) + 1;
}
for (const county of snapshot.counties) {
  addCoverage("census-geography", "available");
  addCoverage("cdc-places", county.sourceStatus === "available"
    ? county.dataCoverage >= 100 ? "available" : "partially_available"
    : "unavailable_from_source");
  addCoverage("census-acs5", acsContext.records[county.fips] ? "available" : "unavailable_from_source");
  const hrsa = hrsaContext.counties[county.fips];
  addCoverage("hrsa-workforce", (hrsa?.hpsa.length ?? 0) + (hrsa?.muaP.length ?? 0)
    ? "available" : "unavailable_from_source");
  addCoverage("ahrf-workforce", ahrfContext.counties[county.fips]?.observations.some(
    (item: { value: unknown }) => item.value !== null,
  ) ? "available" : "unavailable_from_source");
  addCoverage("ahrq-clh", ahrqContext.counties[county.fips]?.observations.some(
    (item: { value: unknown }) => item.value !== null,
  ) ? "available" : "unavailable_from_source");
  const local = localPlans.get(county.fips) as { verificationStatus?: string; candidates?: unknown[] } | undefined;
  addCoverage("local-planning-documents", local?.verificationStatus === "verified"
    ? "available" : local?.candidates?.length ? "awaiting_human_review" : "not_yet_verified");
}
const missingCounties = geographyCoverage.counts.countiesAndEquivalents - countyGeoids.size;
if (missingCounties !== 0 || failures.length) {
  throw new Error(`National brief validation failed: missing=${missingCounties}, invalid=${failures.length}`);
}

const states = new Map<string, typeof snapshot.counties>();
for (const county of snapshot.counties) {
  const list = states.get(county.stateCode) ?? [];
  list.push(county);
  states.set(county.stateCode, list);
}
const randomStateSample = [...states.entries()].map(([state, counties]) => {
  const digest = createHash("sha256").update(`${snapshotId}|${state}`).digest();
  const index = digest.readUInt32BE(0) % counties.length;
  return { state, geoid: counties[index].fips, name: counties[index].county };
});
const evaluationGeoids = ["36001", "36093", "36057", "42029", "48029"];
const report = {
  schemaVersion: "sozorock.national-coverage-report.v1",
  generatedAt,
  snapshotId,
  authoritativeCountyCount: geographyCoverage.authoritativePrimaryCountyCount,
  loadedCountyCount: snapshot.counties.length,
  searchableCountyCount: countyGeoids.size,
  validPlaceBriefCount: snapshot.counties.length - failures.length,
  sourceCoverageCounts,
  geographyQuality: {
    duplicates: geographyCoverage.duplicateCountyGeoids.length,
    orphans: geographyCoverage.orphanCounties.length,
    invalidFips: geographyCoverage.invalidCountyGeoids.length,
    missingGeometryMetadata: geographyCoverage.missingGeometryMetadata.length,
  },
  territories: geographyCoverage.jurisdictions,
  evaluationPlaces: evaluationGeoids.map((geoid) => ({
    geoid,
    found: countyGeoids.has(geoid),
    briefValid: countyGeoids.has(geoid)
      ? validateExplorePlaceBriefV1(buildCountyPlaceBrief(snapshot.counties.find((county) => county.fips === geoid)!, snapshot)).valid
      : false,
  })),
  randomStateSample,
  failures,
};
const coverageTable = Object.entries(report.sourceCoverageCounts)
  .flatMap(([sourceId, statuses]) =>
    Object.entries(statuses).map(([status, count]) => `| ${sourceId} | ${status} | ${count.toLocaleString("en-US")} |`))
  .join("\n");
const evaluationTable = report.evaluationPlaces
  .map((place) => `| ${place.geoid} | ${place.found ? "Yes" : "No"} | ${place.briefValid ? "Pass" : "Fail"} |`)
  .join("\n");
const human = `# Nationwide Evidence Activation Coverage

- Official Census 2025 county and county-equivalent count: ${report.authoritativeCountyCount.toLocaleString("en-US")}
- Loaded: ${report.loadedCountyCount.toLocaleString("en-US")}
- Searchable: ${report.searchableCountyCount.toLocaleString("en-US")}
- Schema-valid ExplorePlaceBriefV1 responses: ${report.validPlaceBriefCount.toLocaleString("en-US")}
- Duplicate county GEOIDs: ${report.geographyQuality.duplicates}
- Orphan counties: ${report.geographyQuality.orphans}
- Invalid county GEOIDs: ${report.geographyQuality.invalidFips}
- Missing required geometry metadata: ${report.geographyQuality.missingGeometryMetadata}

## Evidence coverage

| Source | Status | Counties |
|---|---|---:|
${coverageTable}

## Evaluation places

| County GEOID | Found | Brief contract |
|---|---|---|
${evaluationTable}

## Extended coverage

- Puerto Rico: inventoried separately from the 50-state-plus-DC release scope.
- American Samoa, Guam, Northern Mariana Islands and U.S. Virgin Islands: inventoried as island-area extended coverage.

Every county remains present even when a public-data source or verified local plan is unavailable. Source coverage is reported separately and missing values are never converted to zero.
`;

await mkdir(nationalDir, { recursive: true });
await Promise.all([
  writeFile(path.join(nationalDir, "county-evidence-snapshot.v1.json"), `${JSON.stringify(snapshot)}\n`),
  writeFile(path.join(nationalDir, "national-coverage-report.v1.json"), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(path.join(nationalDir, "national-coverage-report.v1.md"), human),
]);
console.log(JSON.stringify(report, null, 2));
