import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import type { NationalGeographyCatalog } from "../src/national/geography.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nationalDir = path.join(packageRoot, "data", "national");
const catalog = JSON.parse(
  gunzipSync(await readFile(path.join(nationalDir, "national-geography.v2025.json.gz"))).toString("utf8"),
) as NationalGeographyCatalog;

const countyByGeoid = new Map(
  catalog.geographies
    .filter((item) => item.kind === "county" && item.releaseScope === "primary_50_states_dc")
    .map((item) => [item.geoid, item]),
);

const zctas: Record<string, Array<{
  countyGeoid: string;
  countyName: string;
  statePostalCode: string;
  overlapAreaPercent: number | null;
}>> = {};

for (const relationship of catalog.relationships) {
  if (relationship.fromKind !== "zcta" || relationship.toKind !== "county") continue;
  const county = countyByGeoid.get(relationship.toGeoid);
  if (!county) continue;
  (zctas[relationship.fromGeoid] ??= []).push({
    countyGeoid: county.geoid,
    countyName: county.name,
    statePostalCode: county.statePostalCode ?? "",
    overlapAreaPercent: relationship.overlapAreaPercent,
  });
}

for (const counties of Object.values(zctas)) {
  counties.sort((left, right) =>
    (right.overlapAreaPercent ?? -1) - (left.overlapAreaPercent ?? -1)
      || left.countyGeoid.localeCompare(right.countyGeoid));
}

const index = {
  schemaVersion: "sozorock.county-resolution-index.v1",
  generatedAt: catalog.generatedAt,
  censusGeographyVintage: catalog.sourceVintage,
  zctaRelationshipVintage: catalog.relationshipVintage,
  method: "Official Census ZCTA-to-county land-area relationship",
  sourceUrl: catalog.sources.find((source) => source.id === "zctaCountyRelationships")?.url ?? "",
  caveat: "A postal ZIP Code is not a Census ZCTA. This search uses the same-numbered ZCTA as a public geographic proxy and preserves every county overlap.",
  zctas,
};

await writeFile(
  path.join(nationalDir, "county-resolution-index.v1.json"),
  `${JSON.stringify(index)}\n`,
);

console.log(JSON.stringify({
  output: path.join(nationalDir, "county-resolution-index.v1.json"),
  zctaCount: Object.keys(zctas).length,
  relationshipCount: Object.values(zctas).reduce((sum, counties) => sum + counties.length, 0),
}, null, 2));
