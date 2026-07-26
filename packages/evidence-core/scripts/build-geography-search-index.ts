import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import type { NationalGeographyCatalog } from "../src/national/geography.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nationalDir = path.join(packageRoot, "data", "national");
const catalog = JSON.parse(gunzipSync(
  await readFile(path.join(nationalDir, "national-geography.v2025.json.gz")),
).toString("utf8")) as NationalGeographyCatalog;

const records = catalog.geographies
  .filter((geography) =>
    geography.releaseScope === "primary_50_states_dc"
    && (geography.kind === "county" || geography.kind === "census_place" || geography.kind === "zcta"))
  .map((geography) => ({
    kind: geography.kind === "census_place" ? "place" : geography.kind === "zcta" ? "zip" : "county",
    geoid: geography.geoid,
    label: geography.kind === "zcta" ? `ZIP Code ${geography.geoid}` : geography.displayName,
    name: geography.name,
    stateFips: geography.stateFips,
    statePostalCode: geography.statePostalCode,
    geographyTypeLabel: geography.geographyTypeLabel,
    landAreaSquareMeters: geography.landAreaSquareMeters,
  }))
  .sort((left, right) =>
    left.kind.localeCompare(right.kind)
    || left.geoid.localeCompare(right.geoid));

const counts = records.reduce<Record<string, number>>((result, record) => {
  result[record.kind] = (result[record.kind] ?? 0) + 1;
  return result;
}, {});

if (counts.county !== 3_144 || counts.place !== 32_058 || counts.zip !== 33_354) {
  throw new Error(`Unexpected primary geography counts: ${JSON.stringify(counts)}`);
}

await writeFile(
  path.join(nationalDir, "geography-search-index.v1.json"),
  `${JSON.stringify({
    schemaVersion: "sozorock.geography-search-index.v1",
    generatedAt: new Date().toISOString(),
    censusVintage: catalog.sourceVintage,
    sourceUrl: "https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html",
    counts,
    records,
  })}\n`,
);

console.log(JSON.stringify({ counts, recordCount: records.length }, null, 2));
