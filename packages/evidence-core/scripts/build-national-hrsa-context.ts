import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { csvObjects } from "../src/adapters/csv.ts";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nationalDir = path.join(packageRoot, "data", "national");
const countyIndex = JSON.parse(
  await readFile(path.join(nationalDir, "county-index.v2025.json"), "utf8"),
) as { counties: Array<{ geoid: string }> };
const canonicalCounties = new Set(countyIndex.counties.map((county) => county.geoid));
const retrievedAt = new Date().toISOString();

const artifacts = [
  { product: "hpsa", discipline: "Primary care", url: "https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_PC.csv" },
  { product: "hpsa", discipline: "Dental health", url: "https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_DH.csv" },
  { product: "hpsa", discipline: "Mental health", url: "https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_MH.csv" },
  { product: "mua_p", discipline: "Medical underservice", url: "https://data.hrsa.gov/DataDownload/DD_Files/MUA_DET.csv" },
] as const;

const counties: Record<string, {
  hpsa: Array<Record<string, string | number | null | boolean>>;
  muaP: Array<Record<string, string | number | null | boolean>>;
}> = Object.fromEntries([...canonicalCounties].map((geoid) => [geoid, { hpsa: [], muaP: [] }]));
const manifests = [];

function numeric(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pushUnique(target: Array<Record<string, string | number | null | boolean>>, value: Record<string, string | number | null | boolean>) {
  const key = JSON.stringify(value);
  if (!target.some((record) => JSON.stringify(record) === key)) target.push(value);
}

for (const artifact of artifacts) {
  const response = await fetch(artifact.url, {
    headers: { Accept: "text/csv,application/octet-stream", "User-Agent": "SozoRock-Evidence-Core/1.0" },
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`HRSA ${artifact.product} import failed: ${response.status} ${artifact.url}`);
  const body = await response.text();
  const rows = csvObjects(body);
  manifests.push({
    product: artifact.product,
    discipline: artifact.discipline,
    url: artifact.url,
    sha256: createHash("sha256").update(body).digest("hex"),
    byteLength: Buffer.byteLength(body),
    rowCount: rows.length,
  });
  for (const row of rows) {
    const countyGeoid = (artifact.product === "hpsa"
      ? row["Common State County FIPS Code"]
      : row["Common State County FIPS Code"] || row["State and County Federal Information Processing Standard Code"])
      ?.padStart(5, "0");
    if (!countyGeoid || !canonicalCounties.has(countyGeoid)) continue;
    if (artifact.product === "hpsa") {
      const status = row["HPSA Status"] ?? "";
      if (!["Designated", "Proposed For Withdrawal", "Proposed for Withdrawal"].includes(status)) continue;
      pushUnique(counties[countyGeoid].hpsa, {
        designationId: row["HPSA ID"] ?? "",
        designationName: row["HPSA Name"] ?? "",
        designationType: row["Designation Type"] ?? "",
        componentType: row["HPSA Component Type Description"] ?? "",
        discipline: row["HPSA Discipline Class"] || artifact.discipline,
        status,
        score: numeric(row["HPSA Score"]),
        designationDate: row["HPSA Designation Date"] ?? null,
        lastUpdateDate: row["HPSA Designation Last Update Date"] ?? null,
        wholeCounty: (row["HPSA Component Type Description"] ?? "").toLowerCase() === "single county"
          && (row["HPSA Geography Identification Number"] ?? "").padStart(5, "0") === countyGeoid,
      });
    } else {
      const status = row["MUA/P Status Description"] ?? "";
      if (!status.toLowerCase().includes("designated")) continue;
      pushUnique(counties[countyGeoid].muaP, {
        designationId: row["MUA/P ID"] ?? "",
        designationName: row["MUA/P Service Area Name"] ?? "",
        designationType: row["Designation Type"] ?? "",
        componentType: row["Medically Underserved Area/Population (MUA/P) Component Geographic Type Description"] ?? "",
        populationType: row["Population Type"] ?? "",
        status,
        imuScore: numeric(row["IMU Score"]),
        designationDate: row["MUA/P Designation Date String"] || row["Designation Date"] || null,
        lastUpdateDate: row["MUA/P Update Date String"] || row["MUA/P Update Date"] || null,
        wholeCounty: (row["Medically Underserved Area/Population (MUA/P) Component Geographic Type Description"] ?? "").toLowerCase().includes("county")
          && !row["County Subdivision Name"]
          && !row["Census Tract"],
      });
    }
  }
}

await writeFile(
  path.join(nationalDir, "hrsa-county-context.v1.json"),
  `${JSON.stringify({
    schemaVersion: "sozorock.hrsa-county-context.v1",
    generatedAt: retrievedAt,
    publisher: "Health Resources and Services Administration",
    officialUrl: "https://data.hrsa.gov/data/download?titleFilter=Shortage+Areas",
    geography: "county association with designation scope retained per row",
    caveat: "Absence of a whole-county designation does not mean a county has no shortage. Population-group, facility, subcounty, and MUA/P records retain their source scope.",
    manifests,
    countyCount: Object.keys(counties).length,
    counties,
  })}\n`,
);

console.log(JSON.stringify({
  countyCount: Object.keys(counties).length,
  countiesWithHpsa: Object.values(counties).filter((county) => county.hpsa.length).length,
  countiesWithMuaP: Object.values(counties).filter((county) => county.muaP.length).length,
  hpsaRecordCount: Object.values(counties).reduce((sum, county) => sum + county.hpsa.length, 0),
  muaPRecordCount: Object.values(counties).reduce((sum, county) => sum + county.muaP.length, 0),
  output: "hrsa-county-context.v1.json",
}, null, 2));
