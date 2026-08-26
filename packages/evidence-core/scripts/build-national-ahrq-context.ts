import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8 } from "fflate";
import { readSheet } from "read-excel-file/node";
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
const canonicalCountyGeoids = new Set(countyIndex.counties.map((county) => county.geoid));

const sourcePageUrl = "https://www.ahrq.gov/data/innovations/clh-data.html";
const codebookUrl =
  "https://www.ahrq.gov/sites/default/files/wysiwyg/sdoh/clh_2023_codebook_2_0.xlsx";
const countyDataUrl =
  "https://www.ahrq.gov/sites/default/files/wysiwyg/sdoh/clh_2023_county_2_0.xlsx";
const requestHeaders = {
  "User-Agent": "Mozilla/5.0 (compatible; SozoRock-Evidence-Core/1.0; public-interest batch import)",
  Referer: sourcePageUrl,
  Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const selectedVariables = [
  {
    id: "ACS_PCT_DISABLE",
    direction: "context-dependent",
    unit: "percent",
    dataPeriod: "2023 CLH file year",
  },
  {
    id: "ACS_PCT_ENGL_NOT_WELL",
    direction: "context-dependent",
    unit: "percent",
    dataPeriod: "2023 CLH file year",
  },
  {
    id: "ACS_PCT_HH_NO_INTERNET",
    direction: "adverse",
    unit: "percent",
    dataPeriod: "2023 CLH file year",
  },
  {
    id: "AHRF_USDA_RUCC_2023",
    direction: "context-dependent",
    unit: "classification code",
    dataPeriod: "2023",
  },
  {
    id: "NCHS_URCS_2023",
    direction: "context-dependent",
    unit: "classification code",
    dataPeriod: "2023",
  },
  {
    id: "SAIPE_PCT_POV",
    direction: "adverse",
    unit: "percent",
    dataPeriod: "2023 CLH file year",
  },
  {
    id: "POS_RHC_RATE",
    direction: "context-dependent",
    unit: "rural health clinics per 1,000 population",
    dataPeriod: "2023 CLH file year",
  },
] as const;

async function downloadXlsx(url: string) {
  const response = await fetch(`${url}?download=1`, {
    headers: requestHeaders,
    signal: AbortSignal.timeout(5 * 60_000),
  });
  if (!response.ok) throw new Error(`AHRQ download failed for ${url}: HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  const bytes = await readBoundedResponseBytes(response, 128 * 1024 * 1024);
  if (
    !contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    || bytes[0] !== 0x50 || bytes[1] !== 0x4b
  ) {
    throw new Error(`AHRQ returned an unexpected artifact for ${url}.`);
  }
  return bytes;
}

function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function sharedStringsFromWorkbook(entries: Record<string, Uint8Array>) {
  const xml = strFromU8(entries["xl/sharedStrings.xml"]);
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml([...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((text) => text[1]).join("")),
  );
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/)?.[0] ?? "";
  let result = 0;
  for (const character of letters) result = (result * 26) + character.charCodeAt(0) - 64;
  return result - 1;
}

function parseCells(rowXml: string, sharedStrings: string[]) {
  const cells = new Map<number, string | number | null>();
  for (const match of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
    const attributes = match[1];
    const body = match[2];
    const reference = attributes.match(/\br="([^"]+)"/)?.[1];
    if (!reference) continue;
    const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? null;
    if (raw === null) {
      cells.set(columnIndex(reference), null);
      continue;
    }
    const value = /\bt="s"/.test(attributes)
      ? sharedStrings[Number(raw)] ?? null
      : Number.isFinite(Number(raw)) ? Number(raw) : decodeXml(raw);
    cells.set(columnIndex(reference), value);
  }
  return cells;
}

const [codebookBytes, dataBytes] = await Promise.all([
  downloadXlsx(codebookUrl),
  downloadXlsx(countyDataUrl),
]);
const xlsxLimits = { maxRows: 10_000, maxColumns: 10_000, maxCellCharacters: 100_000 };
const codebookEntries = extractZipArchiveBounded(codebookBytes, "AHRQ codebook");
assertXlsxStructureLimits(codebookEntries, "AHRQ codebook", xlsxLimits);
const dataEntries = extractZipArchiveBounded(dataBytes, "AHRQ county workbook");
assertXlsxStructureLimits(dataEntries, "AHRQ county workbook", xlsxLimits);
const codebookRows = await readSheet(Buffer.from(codebookBytes), "County");
const [codebookHeaders, ...codebookValues] = codebookRows;
const codebookIndex = new Map(codebookHeaders.map((header, index) => [String(header), index]));
const variableIndex = codebookIndex.get("Variable Name");
const labelIndex = codebookIndex.get("Variable Label");
const sourceIndex = codebookIndex.get("Data Source");
const domainIndex = codebookIndex.get("Domain");
const topicIndex = codebookIndex.get("Topic");
if (
  variableIndex === undefined || labelIndex === undefined || sourceIndex === undefined
  || domainIndex === undefined || topicIndex === undefined
) {
  throw new Error("AHRQ codebook headers do not match the approved parser contract.");
}

const approvedVariables = selectedVariables.map((selected) => {
  const row = codebookValues.find((candidate) => String(candidate[variableIndex]) === selected.id);
  if (!row) throw new Error(`AHRQ variable ${selected.id} is absent from the matching county codebook.`);
  return {
    ...selected,
    label: String(row[labelIndex]),
    originalSource: String(row[sourceIndex] ?? "Not supplied"),
    domain: String(row[domainIndex] ?? "Not supplied"),
    topic: String(row[topicIndex] ?? "Not supplied"),
  };
});

const sharedStrings = sharedStringsFromWorkbook(dataEntries);
const worksheet = strFromU8(dataEntries["xl/worksheets/sheet2.xml"]);
const rowMatches = worksheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g);
const firstRow = rowMatches.next();
if (firstRow.done) throw new Error("AHRQ county data worksheet contains no rows.");
const headerCells = parseCells(firstRow.value[1], sharedStrings);
const dataHeaders = new Map<string, number>();
for (const [index, value] of headerCells) dataHeaders.set(String(value), index);
const countyFipsIndex = dataHeaders.get("COUNTYFIPS");
if (countyFipsIndex === undefined) throw new Error("AHRQ county data does not contain COUNTYFIPS.");
for (const variable of approvedVariables) {
  if (!dataHeaders.has(variable.id)) {
    throw new Error(`AHRQ county data does not contain codebook-approved variable ${variable.id}.`);
  }
}

const counties: Record<string, {
  observations: Array<{
    variableId: string;
    label: string;
    value: string | number | null;
    unit: string;
    dataPeriod: string;
    direction: string;
    originalSource: string;
    domain: string;
    topic: string;
    uncertainty: null;
  }>;
}> = {};

for (const row of rowMatches) {
  const cells = parseCells(row[1], sharedStrings);
  const rawGeoid = cells.get(countyFipsIndex);
  const geoid = String(rawGeoid ?? "").padStart(5, "0");
  if (!canonicalCountyGeoids.has(geoid)) continue;
  counties[geoid] = {
    observations: approvedVariables.map((variable) => ({
      variableId: variable.id,
      label: variable.label,
      value: cells.get(dataHeaders.get(variable.id) as number) ?? null,
      unit: variable.unit,
      dataPeriod: variable.dataPeriod,
      direction: variable.direction,
      originalSource: variable.originalSource,
      domain: variable.domain,
      topic: variable.topic,
      uncertainty: null,
    })),
  };
}

const missingCountyGeoids = [...canonicalCountyGeoids].filter((geoid) => !counties[geoid]);
if (missingCountyGeoids.length) {
  throw new Error(`AHRQ county import omitted ${missingCountyGeoids.length} canonical counties: ${missingCountyGeoids.slice(0, 20).join(", ")}.`);
}

const generatedAt = new Date().toISOString();
const output = {
  schemaVersion: "sozorock.ahrq-clh-county-context.v1",
  generatedAt,
  publisher: "Agency for Healthcare Research and Quality",
  title: "Community-Level Health Database, September 2025 release",
  officialUrl: sourcePageUrl,
  releaseDate: "2025-09-01",
  fileYear: "2023",
  geography: "county",
  caveats: [
    "The Community-Level Health Database combines variables from multiple original sources; variable availability and underlying periods differ.",
    "The selected variables are county context only. They do not establish causation, an individual risk, a local planning priority, or a recommended response.",
    "The workbook does not supply a margin of error for these selected fields; no uncertainty value is fabricated.",
  ],
  manifests: {
    codebook: {
      url: codebookUrl,
      sha256: createHash("sha256").update(codebookBytes).digest("hex"),
      byteLength: codebookBytes.length,
    },
    data: {
      url: countyDataUrl,
      sha256: createHash("sha256").update(dataBytes).digest("hex"),
      byteLength: dataBytes.length,
    },
  },
  approvedVariables,
  countyCount: Object.keys(counties).length,
  counties,
};

await writeFile(
  path.join(nationalDir, "ahrq-clh-county-context.v1.json"),
  `${JSON.stringify(output)}\n`,
);
console.log(JSON.stringify({
  countyCount: output.countyCount,
  variableCount: output.approvedVariables.length,
  codebookSha256: output.manifests.codebook.sha256,
  dataSha256: output.manifests.data.sha256,
  output: "ahrq-clh-county-context.v1.json",
}, null, 2));
