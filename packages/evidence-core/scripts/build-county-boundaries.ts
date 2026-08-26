import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import type { NationalGeographyCatalog } from "../src/national/geography.ts";
import { readBoundedResponseBytes } from "../src/ingestion/bounded-response.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nationalDir = path.join(packageRoot, "data", "national");
const catalog = JSON.parse(gunzipSync(
  await readFile(path.join(nationalDir, "national-geography.v2025.json.gz")),
).toString("utf8")) as NationalGeographyCatalog;
const counties = catalog.geographies.filter((geography) =>
  geography.kind === "county" && geography.releaseScope === "primary_50_states_dc");
const stateFips = [...new Set(counties.map((county) => county.stateFips).filter(Boolean))].sort();
const serviceUrl = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/9/query";

type GeoJsonFeature = {
  type: "Feature";
  properties: { GEOID?: string; NAME?: string };
  geometry: unknown;
};
const features: GeoJsonFeature[] = [];
const requests: Array<{ stateFips: string; url: string; sha256: string; featureCount: number }> = [];

for (const state of stateFips) {
  const url = new URL(serviceUrl);
  Object.entries({
    f: "geojson",
    where: `STATE='${state}'`,
    outFields: "GEOID,NAME,STATE,COUNTY",
    returnGeometry: "true",
    outSR: "4326",
    maxAllowableOffset: "0.001",
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: { Accept: "application/geo+json,application/json", "User-Agent": "SozoRock-Evidence-Core/1.0" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`County boundary request failed for state ${state}: ${response.status}`);
  const bytes = await readBoundedResponseBytes(response, 64 * 1024 * 1024);
  const collection = JSON.parse(new TextDecoder().decode(bytes)) as { features?: GeoJsonFeature[] };
  const stateFeatures = collection.features ?? [];
  features.push(...stateFeatures);
  requests.push({
    stateFips: state ?? "",
    url: url.toString(),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    featureCount: stateFeatures.length,
  });
  console.log(`${state}: ${stateFeatures.length}`);
}

const canonical = new Set(counties.map((county) => county.geoid));
const byGeoid = Object.fromEntries(features
  .filter((feature) => feature.properties.GEOID && canonical.has(feature.properties.GEOID))
  .map((feature) => [feature.properties.GEOID as string, {
    type: feature.type,
    properties: feature.properties,
    geometry: feature.geometry,
  }]));
const missing = [...canonical].filter((geoid) => !byGeoid[geoid]);
if (Object.keys(byGeoid).length !== 3_144 || missing.length) {
  throw new Error(`County boundary coverage failed: ${Object.keys(byGeoid).length}; missing ${missing.join(",")}`);
}

await writeFile(
  path.join(nationalDir, "county-boundaries.v2025.json"),
  `${JSON.stringify({
    schemaVersion: "sozorock.county-boundaries.v1",
    generatedAt: new Date().toISOString(),
    censusVintage: "2025",
    sourceUrl: serviceUrl,
    generalization: "TIGERweb geometry generalized with a 0.001-degree maximum allowable offset for public web mapping.",
    requests,
    byGeoid,
  })}\n`,
);
console.log(JSON.stringify({ countyCount: Object.keys(byGeoid).length, requestCount: requests.length }, null, 2));
