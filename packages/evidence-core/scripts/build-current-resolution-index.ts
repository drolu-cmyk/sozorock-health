import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import type { NationalGeographyCatalog } from "../src/national/geography.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nationalDir = path.join(packageRoot, "data", "national");
const cacheDir = path.join(packageRoot, ".cache", "census-grfc-2025");
const catalog = JSON.parse(gunzipSync(
  await readFile(path.join(nationalDir, "national-geography.v2025.json.gz")),
).toString("utf8")) as NationalGeographyCatalog;

const primaryStates = [...new Set(catalog.geographies
  .filter((geography) => geography.kind === "county" && geography.releaseScope === "primary_50_states_dc")
  .map((geography) => geography.stateFips)
  .filter((value): value is string => Boolean(value)))].sort();
const primaryCounties = new Set(catalog.geographies
  .filter((geography) => geography.kind === "county" && geography.releaseScope === "primary_50_states_dc")
  .map((geography) => geography.geoid));
const countyLabels = new Map(catalog.geographies
  .filter((geography) => geography.kind === "county" && geography.releaseScope === "primary_50_states_dc")
  .map((geography) => [geography.geoid, {
    countyName: geography.name,
    statePostalCode: geography.statePostalCode ?? "",
  }]));
const currentPlaces = new Set(catalog.geographies
  .filter((geography) => geography.kind === "census_place" && geography.releaseScope === "primary_50_states_dc")
  .map((geography) => geography.geoid));
const currentZctas = new Set(catalog.geographies
  .filter((geography) => geography.kind === "zcta" && geography.releaseScope === "primary_50_states_dc")
  .map((geography) => geography.geoid));

type AreaMap = Map<string, Map<string, number>>;
const placeAreas: AreaMap = new Map();
const zctaAreas: AreaMap = new Map();
const manifests: Array<{
  stateFips: string;
  url: string;
  sha256: string;
  bytes: number;
  rows: number;
}> = [];

function addArea(target: AreaMap, geographyGeoid: string, countyGeoid: string, area: number) {
  const counties = target.get(geographyGeoid) ?? new Map<string, number>();
  counties.set(countyGeoid, (counties.get(countyGeoid) ?? 0) + area);
  target.set(geographyGeoid, counties);
}

async function download(stateFips: string) {
  const canonicalUrl = `https://www2.census.gov/geo/docs/maps-data/data/grfc/public_grfc_cur25_${stateFips}.txt`;
  const url = `${canonicalUrl}?download=1`;
  const file = path.join(cacheDir, `public_grfc_cur25_${stateFips}.txt`);
  try {
    await readFile(file);
    return { file, url };
  } catch {
    const response = await fetch(url, {
      headers: { Accept: "text/plain", "User-Agent": "SozoRock-Evidence-Core/1.0" },
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/plain")) {
      throw new Error(`Census GRFC ${stateFips} failed: ${response.status} ${response.headers.get("content-type") ?? "unknown content type"}`);
    }
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(file));
    return { file, url };
  }
}

await mkdir(cacheDir, { recursive: true });

for (const stateFips of primaryStates) {
  const { file, url } = await download(stateFips);
  const hash = createHash("sha256");
  let bytes = 0;
  const hashStream = createReadStream(file);
  for await (const chunk of hashStream) {
    hash.update(chunk);
    bytes += chunk.length;
  }

  const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let headers: string[] = [];
  let rowCount = 0;
  let positions: Record<string, number> | null = null;
  for await (const line of lines) {
    if (!headers.length) {
      headers = line.split("|");
      positions = Object.fromEntries(headers.map((header, index) => [header, index]));
      continue;
    }
    if (!line || !positions) continue;
    rowCount += 1;
    const fields = line.split("|");
    const countyGeoid = `${fields[positions.CURSTATE] ?? ""}${fields[positions.CURCOUNTY] ?? ""}`;
    if (!primaryCounties.has(countyGeoid)) continue;
    const landArea = Number(fields[positions.AREALAND] ?? "0");
    if (!Number.isFinite(landArea) || landArea < 0) continue;
    const placeFp = fields[positions.PLACEFP] ?? "";
    if (placeFp && placeFp !== "99999") {
      const placeGeoid = `${fields[positions.CURSTATE]}${placeFp}`;
      if (currentPlaces.has(placeGeoid)) addArea(placeAreas, placeGeoid, countyGeoid, landArea);
    }
    const zcta = fields[positions.ZCTA5CE] ?? "";
    if (zcta && zcta !== "99999" && currentZctas.has(zcta)) addArea(zctaAreas, zcta, countyGeoid, landArea);
  }
  manifests.push({ stateFips, url, sha256: hash.digest("hex"), bytes, rows: rowCount });
  if (rowCount === 0) throw new Error(`Census GRFC ${stateFips} contained no block rows.`);
  console.log(`${stateFips}: ${rowCount.toLocaleString()} blocks`);
}

function serialize(target: AreaMap) {
  return Object.fromEntries([...target.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([geoid, countyAreas]) => {
      const totalLandArea = [...countyAreas.values()].reduce((sum, area) => sum + area, 0);
      const counties = [...countyAreas.entries()]
        .map(([countyGeoid, landArea]) => {
          const label = countyLabels.get(countyGeoid);
          return {
            countyGeoid,
            countyName: label?.countyName ?? "County or county equivalent",
            statePostalCode: label?.statePostalCode ?? "",
            overlapAreaPercent: totalLandArea > 0 ? Number((landArea / totalLandArea * 100).toFixed(4)) : null,
            overlapPopulationPercent: null,
            landAreaSquareMeters: landArea,
          };
        })
        .sort((left, right) =>
          (right.overlapAreaPercent ?? -1) - (left.overlapAreaPercent ?? -1)
          || left.countyGeoid.localeCompare(right.countyGeoid));
      return [geoid, counties];
    }));
}

const output = {
  schemaVersion: "sozorock.county-resolution-index.v2",
  generatedAt: new Date().toISOString(),
  censusVintage: "2025",
  source: {
    publisher: "U.S. Census Bureau",
    title: "2025 Geographic Reference Files",
    officialUrl: "https://www2.census.gov/geo/docs/maps-data/data/grfc/",
    manifests,
  },
  method: "2025 Census block land area aggregated by current place or ZCTA and current county; percentages use land area and do not imply population share",
  zipCaveat: "A postal ZIP Code is not a Census ZCTA. ZIP input is resolved to the corresponding ZCTA only for county-selection context.",
  placeCaveat: "Census places can cross county boundaries. County evidence begins only after the applicable county is selected.",
  places: serialize(placeAreas),
  zctas: serialize(zctaAreas),
};

await writeFile(
  path.join(nationalDir, "county-resolution-index.v2.json"),
  `${JSON.stringify(output)}\n`,
);

console.log(JSON.stringify({
  stateFileCount: manifests.length,
  currentPlaceCount: currentPlaces.size,
  placesWithRelationships: Object.keys(output.places).length,
  currentZctaCount: currentZctas.size,
  zctasWithRelationships: Object.keys(output.zctas).length,
  output: "county-resolution-index.v2.json",
}, null, 2));

if (process.env.KEEP_CENSUS_GRFC_CACHE !== "true") await rm(cacheDir, { recursive: true, force: true });
