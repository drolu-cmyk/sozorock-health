import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DATA_DIR = path.join(ROOT, "apps", "platform", "public", "data");
const DATA_DIR = path.join(ROOT, "apps", "platform", "data");
const TIGER_BASE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer";
const COUNTY_URL = `${TIGER_BASE}/1/query`;
const STATE_URL = `${TIGER_BASE}/0/query`;
const INCLUDED_STATE_FIPS = [
  "01", "02", "04", "05", "06", "08", "09", "10", "11", "12", "13",
  "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25",
  "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36",
  "37", "38", "39", "40", "41", "42", "44", "45", "46", "47", "48",
  "49", "50", "51", "53", "54", "55", "56",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function queryGeoJson(url, where, outFields, maximumOffset) {
  const params = new URLSearchParams({
    f: "geojson",
    where,
    outFields,
    returnGeometry: "true",
    outSR: "4326",
    maxAllowableOffset: String(maximumOffset),
    geometryPrecision: "4",
    resultRecordCount: "5000",
  });
  const response = await fetch(`${url}?${params}`, {
    headers: {
      Accept: "application/geo+json, application/json",
      "User-Agent": "SozoRock-CB-CAP-Boundary-Pipeline/1.0",
    },
  });
  if (!response.ok) throw new Error(`Boundary request failed (${response.status})`);
  const body = await response.json();
  if (body.type !== "FeatureCollection" || !Array.isArray(body.features)) {
    throw new Error("Census boundary response was not a GeoJSON FeatureCollection");
  }
  return body.features;
}

async function mapWithConcurrency(values, limit, task) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
}

function normalizeFeature(feature, kind) {
  const properties = feature.properties ?? {};
  const fips = String(properties.GEOID ?? properties.STATE ?? "").padStart(2, "0");
  return {
    type: "Feature",
    id: fips,
    properties: kind === "county"
      ? { fips, stateFips: String(properties.STATE ?? fips.slice(0, 2)).padStart(2, "0"), name: String(properties.NAME ?? "") }
      : { fips, name: String(properties.NAME ?? "") },
    geometry: feature.geometry,
  };
}

async function main() {
  const countyGroups = await mapWithConcurrency(INCLUDED_STATE_FIPS, 6, async (stateFips) => {
    const features = await queryGeoJson(
      COUNTY_URL,
      `STATE='${stateFips}'`,
      "GEOID,STATE,NAME",
      0.01,
    );
    return features.map((feature) => normalizeFeature(feature, "county"));
  });
  const counties = countyGroups.flat().sort((a, b) => a.id.localeCompare(b.id));

  const stateWhere = `GEOID IN (${INCLUDED_STATE_FIPS.map((fips) => `'${fips}'`).join(",")})`;
  const states = (await queryGeoJson(STATE_URL, stateWhere, "GEOID,STATE,NAME", 0.02))
    .map((feature) => normalizeFeature(feature, "state"))
    .sort((a, b) => a.id.localeCompare(b.id));

  const countyData = JSON.parse(await readFile(path.join(DATA_DIR, "county-planning.json"), "utf8"));
  const expectedFips = new Set(countyData.map((county) => county.fips));
  const geometryFips = new Set(counties.map((feature) => feature.id));
  if (counties.length !== 3144 || geometryFips.size !== 3144) {
    throw new Error(`Expected 3,144 unique county geometries; received ${counties.length}/${geometryFips.size}`);
  }
  const missing = [...expectedFips].filter((fips) => !geometryFips.has(fips));
  const unexpected = [...geometryFips].filter((fips) => !expectedFips.has(fips));
  if (missing.length || unexpected.length) {
    throw new Error(`Boundary/data mismatch. Missing: ${missing.join(",") || "none"}; unexpected: ${unexpected.join(",") || "none"}`);
  }
  if (states.length !== 51 || new Set(states.map((feature) => feature.id)).size !== 51) {
    throw new Error(`Expected 51 state/DC geometries; received ${states.length}`);
  }

  const snapshot = {
    schemaVersion: 1,
    vintage: "January 1, 2025",
    source: "U.S. Census Bureau TIGERweb State and County layers",
    sourceUrl: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer",
    simplification: "TIGERweb maxAllowableOffset 0.01 degrees for counties and 0.02 degrees for states",
    counties,
    states,
  };
  const json = `${JSON.stringify(snapshot)}\n`;
  const manifest = {
    schemaVersion: snapshot.schemaVersion,
    vintage: snapshot.vintage,
    source: snapshot.source,
    sourceUrl: snapshot.sourceUrl,
    countyCount: counties.length,
    stateCount: states.length,
    sha256: sha256(json),
  };

  await mkdir(PUBLIC_DATA_DIR, { recursive: true });
  await writeFile(path.join(PUBLIC_DATA_DIR, "cbcap-boundaries-2025.json"), json, "utf8");
  await writeFile(path.join(DATA_DIR, "boundary-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
