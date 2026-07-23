import { gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import {
  buildNationalGeographyCatalog,
  OFFICIAL_GEOGRAPHY_URLS,
  parsePipeTable,
  sha256Hex,
  validateNationalGeographyCatalog,
} from "../src/national/geography.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(packageRoot, "data", "national");
const sourceDir = process.env.NATIONAL_GEOGRAPHY_SOURCE_DIR?.trim() || null;
const generatedAt = process.env.NATIONAL_SNAPSHOT_DATE?.trim() || new Date().toISOString();

async function readOfficialArtifact(id: keyof typeof OFFICIAL_GEOGRAPHY_URLS) {
  const url = OFFICIAL_GEOGRAPHY_URLS[id];
  let bytes: Uint8Array;
  if (sourceDir) {
    const inputName = {
      states: "states.zip",
      counties: "counties.zip",
      places: "places.zip",
      zctas: "zctas.zip",
      zctaCountyRelationships: "zcta-county.txt",
    }[id];
    bytes = new Uint8Array(await readFile(path.join(sourceDir, inputName)));
  } else {
    const response = await fetch(url, {
      headers: { Accept: "application/octet-stream,text/plain", "User-Agent": "SozoRock-Evidence-Core/1.0" },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`Official Census download failed (${response.status}) for ${url}`);
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  const text = url.endsWith(".zip")
    ? new TextDecoder().decode(Object.values(unzipSync(bytes))[0])
    : new TextDecoder().decode(bytes);
  return {
    id,
    url,
    text,
    sha256: sha256Hex(bytes),
    byteLength: bytes.byteLength,
  };
}

const artifacts = await Promise.all([
  readOfficialArtifact("states"),
  readOfficialArtifact("counties"),
  readOfficialArtifact("places"),
  readOfficialArtifact("zctas"),
  readOfficialArtifact("zctaCountyRelationships"),
]);
const byId = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
const catalog = buildNationalGeographyCatalog({
  generatedAt,
  states: parsePipeTable(byId.get("states")!.text),
  counties: parsePipeTable(byId.get("counties")!.text),
  places: parsePipeTable(byId.get("places")!.text),
  zctas: parsePipeTable(byId.get("zctas")!.text),
  zctaCountyRelationships: parsePipeTable(byId.get("zctaCountyRelationships")!.text),
  sources: artifacts.map(({ id, url, sha256, byteLength }) => ({ id, url, sha256, byteLength })),
});
const validation = validateNationalGeographyCatalog(catalog);
if (!validation.valid) {
  throw new Error(`National geography validation failed: ${JSON.stringify(validation)}`);
}

const counties = catalog.geographies
  .filter((record) => record.kind === "county" && record.releaseScope === "primary_50_states_dc")
  .map((record) => ({
    id: record.id,
    geoid: record.geoid,
    name: record.name,
    displayName: record.displayName,
    stateFips: record.stateFips,
    statePostalCode: record.statePostalCode,
    countyEquivalentType: record.geographyTypeLabel,
    vintage: record.vintage,
    internalPoint: record.internalPoint,
    aliases: [record.geoid, record.name, record.displayName],
  }))
  .sort((left, right) => left.geoid.localeCompare(right.geoid));

const sourceManifest = {
  schemaVersion: "sozorock.import-manifest.v1",
  generatedAt,
  contentSha256: sha256Hex(JSON.stringify(catalog)),
  authoritativePrimaryCountyCount: validation.authoritativePrimaryCountyCount,
  sources: catalog.sources,
  artifacts: {
    catalog: "national-geography.v2025.json.gz",
    countyIndex: "county-index.v2025.json",
    coverageReport: "national-geography-coverage.v2025.json",
  },
};
const humanReport = `# National Geography Coverage — Census ${catalog.sourceVintage}

- Generated: ${generatedAt}
- Primary release scope: 50 states and the District of Columbia
- Authoritative counties and county equivalents: ${validation.authoritativePrimaryCountyCount.toLocaleString("en-US")}
- Census places: ${validation.counts.censusPlaces.toLocaleString("en-US")}
- ZCTAs: ${validation.counts.zctas.toLocaleString("en-US")}
- Cross-county ZCTAs preserved: ${validation.crossCountyZctaCount.toLocaleString("en-US")}
- Duplicate county GEOIDs: ${validation.duplicateCountyGeoids.length}
- Orphan counties: ${validation.orphanCounties.length}
- Invalid county GEOIDs: ${validation.invalidCountyGeoids.length}
- Missing county geometry metadata: ${validation.missingGeometryMetadata.length}

Puerto Rico is inventoried as extended coverage. American Samoa, Guam, the Commonwealth of the Northern Mariana Islands, and the U.S. Virgin Islands are inventoried separately because the selected national Gazetteer files exclude island areas.

Postal ZIP Codes remain distinct from Census ZCTAs. ZCTA-to-county overlap uses the official 2020 Census relationship file and retains its vintage caveat.
`;

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDir, "national-geography.v2025.json.gz"), gzipSync(JSON.stringify(catalog), { level: 9 })),
  writeFile(path.join(outputDir, "county-index.v2025.json"), `${JSON.stringify({ schemaVersion: "sozorock.county-index.v1", generatedAt, counties }, null, 2)}\n`),
  writeFile(path.join(outputDir, "national-geography-coverage.v2025.json"), `${JSON.stringify({ ...validation, jurisdictions: catalog.jurisdictions }, null, 2)}\n`),
  writeFile(path.join(outputDir, "national-geography-coverage.v2025.md"), humanReport),
  writeFile(path.join(outputDir, "import-manifest.v2025.json"), `${JSON.stringify(sourceManifest, null, 2)}\n`),
]);

console.log(JSON.stringify({ outputDir, ...validation }, null, 2));
