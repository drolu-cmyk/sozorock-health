import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(gunzipSync(await readFile(
  path.resolve(appRoot, "../../packages/evidence-core/data/national/national-geography.v2025.json.gz"),
)).toString("utf8"));
const counties = catalog.geographies.filter((item) =>
  item.kind === "county" && item.releaseScope === "primary_50_states_dc");
if (counties.length !== 3_144) throw new Error(`Expected 3,144 counties; found ${counties.length}.`);

const baseUrl = process.env.EXPLORE_VALIDATION_BASE_URL ?? "http://localhost:4318";
const failures = [];
let cursor = 0;
let validated = 0;
async function worker() {
  while (cursor < counties.length) {
    const county = counties[cursor++];
    const response = await fetch(
      `${baseUrl}/api/evidence/v1/place-brief?geography=county&geoid=${county.geoid}`,
    );
    if (!response.ok) {
      failures.push({ geoid: county.geoid, status: response.status });
      continue;
    }
    const brief = await response.json();
    const sources = new Set(brief.publicData?.sourceCoverage?.map((item) => item.sourceId) ?? []);
    const required = [
      "census-geography", "cdc-places", "census-acs5", "hrsa-workforce",
      "ahrf-workforce", "ahrq-clh", "local-planning-documents",
    ];
    if (
      brief.contractVersion !== "explore.place-brief.v1"
      || brief.resolution?.selected?.authorityId !== county.geoid
      || required.some((source) => !sources.has(source))
    ) {
      failures.push({ geoid: county.geoid, status: "invalid_contract_or_coverage" });
      continue;
    }
    validated += 1;
  }
}
await Promise.all(Array.from({ length: 24 }, () => worker()));
if (failures.length) throw new Error(`National API validation failed: ${JSON.stringify(failures.slice(0, 20))}`);
console.log(JSON.stringify({
  authoritativeCountyCount: counties.length,
  validPlaceBriefCount: validated,
  baseUrl,
}, null, 2));
