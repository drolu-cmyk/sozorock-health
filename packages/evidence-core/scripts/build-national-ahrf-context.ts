import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { csvObjects } from "../src/adapters/csv.ts";
import {
  assertXlsxStructureLimits,
  extractZipArchiveBounded,
  readBoundedResponseBytes,
} from "../src/ingestion/bounded-response.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nationalDir = path.join(packageRoot, "data", "national");
const countyIndex = JSON.parse(
  await readFile(path.join(nationalDir, "county-index.v2025.json"), "utf8"),
) as { counties: Array<{ geoid: string }> };
const canonicalCounties = new Set(countyIndex.counties.map((county) => county.geoid));
const dataUrl = "https://data.hrsa.gov/DataDownload/AHRF/AHRF_2024-2025_CSV.zip";
const documentationUrl = "https://data.hrsa.gov/DataDownload/AHRF/AHRF_USER_TECH_2024-2025.zip";
const officialUrl = "https://data.hrsa.gov/data/download?data=AHRF";

const variableDefinitions = [
  { id: "popn_est_23", label: "Estimated population", unit: "people", year: "2023", direction: "context-dependent" },
  { id: "phys_nf_prim_care_pc_exc_rsdt_23", label: "Nonfederal primary care physicians, excluding residents", unit: "professionals", year: "2023", direction: "context-dependent" },
  { id: "dent_nf_fed_proflly_activ_23", label: "Professionally active dentists", unit: "professionals", year: "2023", direction: "context-dependent" },
  { id: "rural_hlth_clincs_23", label: "Rural health clinics", unit: "facilities", year: "2023", direction: "context-dependent" },
  { id: "stgh_23", label: "Short-term general hospitals", unit: "facilities", year: "2023", direction: "context-dependent" },
  { id: "nhsc_prim_care_sites_24", label: "National Health Service Corps primary care sites", unit: "sites", year: "2024", direction: "context-dependent" },
  { id: "nhsc_fte_prim_care_provdrs_24", label: "National Health Service Corps primary care provider FTEs", unit: "full-time equivalents", year: "2024", direction: "context-dependent" },
] as const;

async function officialArtifact(url: string) {
  const response = await fetch(`${url}?download=1`, {
    headers: {
      Accept: "application/zip,application/octet-stream,*/*",
      "User-Agent": "Mozilla/5.0 SozoRock-Evidence-Core/1.0",
      Referer: officialUrl,
    },
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`AHRF artifact failed: ${response.status} ${url}`);
  const bytes = await readBoundedResponseBytes(response, 256 * 1024 * 1024);
  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

const [dataArtifact, documentationArtifact] = await Promise.all([
  officialArtifact(dataUrl),
  officialArtifact(documentationUrl),
]);
const dataZip = extractZipArchiveBounded(dataArtifact.bytes, "AHRF data archive", {
  maxUncompressedBytes: 512 * 1024 * 1024,
});
const dataEntry = Object.keys(dataZip).find((name) => name.endsWith("/AHRF2025.csv"));
if (!dataEntry) throw new Error("The approved AHRF archive does not contain AHRF2025.csv.");
const csvText = new TextDecoder().decode(dataZip[dataEntry]);
const headers = new Set(csvText.slice(0, csvText.indexOf("\n")).replace(/^\uFEFF/, "").split(","));

const documentationZip = extractZipArchiveBounded(documentationArtifact.bytes, "AHRF documentation archive", {
  maxUncompressedBytes: 512 * 1024 * 1024,
});
const documentationEntry = Object.keys(documentationZip).find((name) =>
  name.endsWith("AHRF 2024-2025 Technical Documentation.xlsx"));
if (!documentationEntry) throw new Error("The approved AHRF technical-documentation archive is missing its workbook.");
const workbookZip = extractZipArchiveBounded(
  documentationZip[documentationEntry],
  "AHRF technical-documentation workbook",
);
assertXlsxStructureLimits(workbookZip, "AHRF technical-documentation workbook", {
  maxRows: 100_000,
  maxColumns: 10_000,
  maxCellCharacters: 100_000,
});
const sharedStrings = new TextDecoder().decode(workbookZip["xl/sharedStrings.xml"]);
for (const variable of variableDefinitions) {
  if (!headers.has(variable.id)) throw new Error(`AHRF data file is missing approved variable ${variable.id}.`);
  if (!sharedStrings.includes(variable.id)) throw new Error(`AHRF technical documentation does not define ${variable.id}.`);
}

function numeric(value: string | undefined) {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const counties = Object.fromEntries([...canonicalCounties].map((geoid) => [geoid, {
  observations: [] as Array<{
    variableId: string;
    label: string;
    value: number | null;
    unit: string;
    year: string;
    direction: string;
  }>,
}]));

for (const row of csvObjects(csvText)) {
  const geoid = row.fips_st_cnty?.padStart(5, "0");
  if (!geoid || !canonicalCounties.has(geoid)) continue;
  counties[geoid].observations = variableDefinitions.map((variable) => ({
    variableId: variable.id,
    label: variable.label,
    value: numeric(row[variable.id]),
    unit: variable.unit,
    year: variable.year,
    direction: variable.direction,
  }));
}

const generatedAt = new Date().toISOString();
await writeFile(
  path.join(nationalDir, "ahrf-county-context.v1.json"),
  `${JSON.stringify({
    schemaVersion: "sozorock.ahrf-county-context.v1",
    generatedAt,
    publisher: "Health Resources and Services Administration, Bureau of Health Workforce",
    title: "Area Health Resources Files 2024–2025 county release",
    officialUrl,
    dataUrl,
    documentationUrl,
    releaseDate: "2025-12-18",
    dataPeriods: ["2023", "2024"],
    geography: "county",
    caveat: "AHRF combines source-specific years. Counts are contextual and do not by themselves establish local need, shortage, causation, or a recommended response.",
    manifests: {
      data: { sha256: dataArtifact.sha256, byteLength: dataArtifact.bytes.byteLength },
      documentation: { sha256: documentationArtifact.sha256, byteLength: documentationArtifact.bytes.byteLength },
    },
    approvedVariables: variableDefinitions,
    countyCount: Object.keys(counties).length,
    counties,
  })}\n`,
);

console.log(JSON.stringify({
  countyCount: Object.keys(counties).length,
  countiesWithEveryApprovedVariable: Object.values(counties)
    .filter((county) => county.observations.length === variableDefinitions.length).length,
  approvedVariableCount: variableDefinitions.length,
  output: "ahrf-county-context.v1.json",
}, null, 2));
