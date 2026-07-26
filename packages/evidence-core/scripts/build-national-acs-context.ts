import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nationalDir = path.join(packageRoot, "data", "national");
const countyIndex = JSON.parse(
  await readFile(path.join(nationalDir, "county-index.v2025.json"), "utf8"),
) as { counties: Array<{ geoid: string }> };

const vintage = 2024;
const releaseDate = "2026-01-29";
const dataPeriod = { start: "2020-01-01", end: "2024-12-31" };
const summaryFileRoot =
  "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData";
const tableIds = ["B01001", "B01002", "B17001", "B08201", "B28002"] as const;
const canonicalCountyGeoids = new Set(countyIndex.counties.map((county) => county.geoid));
const retrievedAt = new Date().toISOString();

type TableRow = Record<string, number | null>;
const rowsByTable = new Map<string, Map<string, TableRow>>();
const sourceArtifacts: Array<{
  tableId: string;
  url: string;
  sha256: string;
  byteLength: number;
  countyRowCount: number;
}> = [];

function numeric(value: string | undefined) {
  if (value === undefined || value === null || value === "" || value.startsWith("-")) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentage(numerator: number | null, denominator: number | null) {
  return numerator === null || denominator === null || denominator <= 0
    ? null
    : Number(((numerator / denominator) * 100).toFixed(1));
}

function percentageMarginOfError(
  numerator: number | null,
  numeratorMoe: number | null,
  denominator: number | null,
  denominatorMoe: number | null,
) {
  if (
    numerator === null || numeratorMoe === null || denominator === null ||
    denominatorMoe === null || denominator <= 0
  ) return null;
  const ratio = numerator / denominator;
  const subtraction = (numeratorMoe ** 2) - ((ratio ** 2) * (denominatorMoe ** 2));
  const variance = subtraction >= 0
    ? subtraction
    : (numeratorMoe ** 2) + ((ratio ** 2) * (denominatorMoe ** 2));
  return Number(((Math.sqrt(variance) / denominator) * 100).toFixed(1));
}

async function readCountyTable(tableId: string) {
  const url = `${summaryFileRoot}/acsdt5y2024-${tableId.toLowerCase()}.dat`;
  const response = await fetch(url, {
    headers: {
      Accept: "text/plain",
      "User-Agent": "SozoRock-Evidence-Core/1.0 (public-interest batch import)",
    },
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`ACS ${vintage} table ${tableId} import failed: HTTP ${response.status}.`);
  }

  const digest = createHash("sha256");
  let byteLength = 0;
  const hashingStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      digest.update(chunk);
      byteLength += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
  const body = response.body.pipeThrough(hashingStream);
  const lines = createInterface({
    input: Readable.fromWeb(body as never),
    crlfDelay: Infinity,
  });

  let headers: string[] | null = null;
  const countyRows = new Map<string, TableRow>();
  for await (const line of lines) {
    if (!headers) {
      headers = line.split("|");
      if (headers[0] !== "GEO_ID") {
        throw new Error(`ACS ${tableId} has an unexpected header.`);
      }
      continue;
    }
    if (!line.startsWith("0500000US")) continue;
    const values = line.split("|");
    const geoid = values[0]?.slice(-5);
    if (!geoid || !canonicalCountyGeoids.has(geoid)) continue;
    countyRows.set(
      geoid,
      Object.fromEntries(headers.slice(1).map((header, index) => [header, numeric(values[index + 1])])),
    );
  }
  if (countyRows.size !== canonicalCountyGeoids.size) {
    const missing = [...canonicalCountyGeoids].filter((geoid) => !countyRows.has(geoid));
    throw new Error(
      `ACS ${tableId} contains ${countyRows.size}/${canonicalCountyGeoids.size} canonical counties; missing ${missing.slice(0, 20).join(", ")}.`,
    );
  }
  rowsByTable.set(tableId, countyRows);
  sourceArtifacts.push({
    tableId,
    url,
    sha256: digest.digest("hex"),
    byteLength,
    countyRowCount: countyRows.size,
  });
}

for (const tableId of tableIds) {
  await readCountyTable(tableId);
}

function value(tableId: string, geoid: string, field: string) {
  return rowsByTable.get(tableId)?.get(geoid)?.[field] ?? null;
}

const records: Record<string, Record<string, number | null>> = {};
for (const geoid of canonicalCountyGeoids) {
  const povertyDenominator = value("B17001", geoid, "B17001_E001");
  const povertyDenominatorMoe = value("B17001", geoid, "B17001_M001");
  const povertyNumerator = value("B17001", geoid, "B17001_E002");
  const povertyNumeratorMoe = value("B17001", geoid, "B17001_M002");
  const vehicleDenominator = value("B08201", geoid, "B08201_E001");
  const vehicleDenominatorMoe = value("B08201", geoid, "B08201_M001");
  const noVehicleNumerator = value("B08201", geoid, "B08201_E002");
  const noVehicleNumeratorMoe = value("B08201", geoid, "B08201_M002");
  const internetDenominator = value("B28002", geoid, "B28002_E001");
  const internetDenominatorMoe = value("B28002", geoid, "B28002_M001");
  const internetNumerator = value("B28002", geoid, "B28002_E002");
  const internetNumeratorMoe = value("B28002", geoid, "B28002_M002");
  records[geoid] = {
    population: value("B01001", geoid, "B01001_E001"),
    populationMoe: value("B01001", geoid, "B01001_M001"),
    medianAge: value("B01002", geoid, "B01002_E001"),
    medianAgeMoe: value("B01002", geoid, "B01002_M001"),
    povertyPercent: percentage(povertyNumerator, povertyDenominator),
    povertyPercentMoe: percentageMarginOfError(
      povertyNumerator,
      povertyNumeratorMoe,
      povertyDenominator,
      povertyDenominatorMoe,
    ),
    povertyNumerator,
    povertyNumeratorMoe,
    povertyDenominator,
    povertyDenominatorMoe,
    noVehiclePercent: percentage(noVehicleNumerator, vehicleDenominator),
    noVehiclePercentMoe: percentageMarginOfError(
      noVehicleNumerator,
      noVehicleNumeratorMoe,
      vehicleDenominator,
      vehicleDenominatorMoe,
    ),
    noVehicleNumerator,
    noVehicleNumeratorMoe,
    noVehicleDenominator: vehicleDenominator,
    noVehicleDenominatorMoe: vehicleDenominatorMoe,
    internetSubscriptionPercent: percentage(internetNumerator, internetDenominator),
    internetSubscriptionPercentMoe: percentageMarginOfError(
      internetNumerator,
      internetNumeratorMoe,
      internetDenominator,
      internetDenominatorMoe,
    ),
    internetSubscriptionNumerator: internetNumerator,
    internetSubscriptionNumeratorMoe: internetNumeratorMoe,
    internetSubscriptionDenominator: internetDenominator,
    internetSubscriptionDenominatorMoe: internetDenominatorMoe,
  };
}

const output = {
  schemaVersion: "sozorock.acs-county-context.v1",
  generatedAt: retrievedAt,
  source: {
    publisher: "U.S. Census Bureau",
    title: "2020–2024 American Community Survey five-year estimates",
    officialUrl: "https://www.census.gov/programs-surveys/acs/data/summary-file.2024.html",
    distributionUrl: summaryFileRoot,
    releaseDate,
    dataPeriod,
    retrievedAt,
    geography: "county",
    format: "Table-Based ACS Summary File",
    variables: {
      population: { estimate: "B01001_E001", marginOfError: "B01001_M001", unit: "count", direction: "contextual", universe: "Total population" },
      medianAge: { estimate: "B01002_E001", marginOfError: "B01002_M001", unit: "years", direction: "contextual", universe: "Total population" },
      povertyPercent: { numerator: "B17001_E002", denominator: "B17001_E001", unit: "percent", direction: "adverse", universe: "Population for whom poverty status is determined" },
      noVehiclePercent: { numerator: "B08201_E002", denominator: "B08201_E001", unit: "percent", direction: "adverse", universe: "Households" },
      internetSubscriptionPercent: { numerator: "B28002_E002", denominator: "B28002_E001", unit: "percent", direction: "protective", universe: "Households" },
    },
  },
  sourceArtifacts,
  countyCount: Object.keys(records).length,
  records,
};

await writeFile(
  path.join(nationalDir, "acs-county-context.v1.json"),
  `${JSON.stringify(output)}\n`,
);
console.log(JSON.stringify({
  countyCount: output.countyCount,
  sourceArtifacts: sourceArtifacts.length,
  bytesRead: sourceArtifacts.reduce((sum, artifact) => sum + artifact.byteLength, 0),
  output: "acs-county-context.v1.json",
}, null, 2));
