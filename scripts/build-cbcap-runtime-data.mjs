import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "apps", "platform", "data");
const PUBLIC_DATA_DIR = path.join(ROOT, "apps", "platform", "public", "data");

const conditionKeys = [
  "highBloodPressure", "diabetes", "coronaryHeartDisease", "stroke", "cancer",
  "asthma", "copd", "depression", "obesity",
];
const barrierKeys = [
  "uninsured", "transportation", "foodInsecurity", "housingInsecurity",
  "utilityShutoff", "loneliness", "disability",
];
const preventionKeys = [
  "annualCheckup", "dentalVisit", "cholesterolScreening", "colorectalScreening", "mammography",
];

function weightedValue(records, group, key) {
  let numerator = 0;
  let denominator = 0;
  for (const record of records) {
    const value = record[group][key].value;
    const population = record.adultPopulation ?? record.population;
    if (value === null || population === null || population <= 0) continue;
    numerator += value * population;
    denominator += population;
  }
  return denominator ? Math.round((numerator / denominator) * 10) / 10 : null;
}

function benchmarkFor(records, name) {
  return {
    name,
    population: records.reduce((sum, record) => sum + (record.population ?? 0), 0),
    conditions: Object.fromEntries(conditionKeys.map((key) => [key, weightedValue(records, "conditions", key)])),
    barriers: Object.fromEntries(barrierKeys.map((key) => [key, weightedValue(records, "barriers", key)])),
    prevention: Object.fromEntries(preventionKeys.map((key) => [key, weightedValue(records, "prevention", key)])),
  };
}

function median(values) {
  const available = values.filter((value) => value !== null).sort((a, b) => a - b);
  if (!available.length) return null;
  const middle = Math.floor(available.length / 2);
  return available.length % 2
    ? available[middle]
    : Math.round((available[middle - 1] + available[middle]) / 2);
}

async function main() {
  const [records, sourceManifest] = await Promise.all([
    readFile(path.join(DATA_DIR, "county-planning.json"), "utf8").then(JSON.parse),
    readFile(path.join(DATA_DIR, "source-manifest.json"), "utf8").then(JSON.parse),
  ]);
  const authoritativeCountyCount = Number(sourceManifest.geography?.countyCount);
  if (!Number.isInteger(authoritativeCountyCount) || authoritativeCountyCount <= 0) {
    throw new Error("The official geography manifest must declare a positive derived county count");
  }
  if (records.length !== authoritativeCountyCount
    || new Set(records.map((record) => record.fips)).size !== authoritativeCountyCount) {
    throw new Error(`Runtime snapshots require ${authoritativeCountyCount.toLocaleString("en-US")} unique county equivalents from the official geography manifest`);
  }

  const stateIdentity = [...new Map(records.map((record) => [record.stateFips, {
    fips: record.stateFips,
    name: record.state,
    code: record.stateCode,
  }])).values()].sort((left, right) => left.name.localeCompare(right.name));

  const states = stateIdentity.map((state) => {
    const stateRecords = records.filter((record) => record.stateFips === state.fips);
    return {
      ...state,
      countyCount: stateRecords.length,
      population: stateRecords.reduce((sum, record) => sum + (record.population ?? 0), 0),
      dataCoverage: Math.round(
        stateRecords.reduce((sum, record) => sum + record.dataCoverage, 0) / Math.max(stateRecords.length, 1),
      ),
      medianPlanningPressure: median(stateRecords.map((record) => record.planning.planningPressure)),
    };
  });

  const availableCountyCount = records.filter((record) => record.sourceStatus === "available").length;
  const dashboardSummary = {
    states,
    nationalBenchmark: benchmarkFor(records, "United States county benchmark"),
    sources: sourceManifest,
    coverage: {
      countyCount: records.length,
      availableCountyCount,
      planningIndexAvailable: sourceManifest.quality.planningIndexAvailable,
      totalPopulation: records.reduce((sum, record) => sum + (record.population ?? 0), 0),
    },
  };

  const countyMap = {
    version: 1,
    countyCount: records.length,
    sourceHash: sourceManifest.quality.sha256,
    records: records.map((record) => [
      record.fips,
      record.county,
      record.population,
      record.dataCoverage,
      record.sourceStatus === "available" ? 1 : 0,
      record.planning.planningPressure,
      record.planning.chronicPercentile,
      record.planning.barrierPercentile,
      record.planning.preventionOpportunityPercentile,
      record.conditions.diabetes.value,
      record.conditions.highBloodPressure.value,
      record.barriers.uninsured.value,
      record.barriers.transportation.value,
    ]),
  };

  await mkdir(PUBLIC_DATA_DIR, { recursive: true });
  await Promise.all([
    writeFile(path.join(DATA_DIR, "dashboard-summary.json"), `${JSON.stringify(dashboardSummary)}\n`, "utf8"),
    writeFile(path.join(PUBLIC_DATA_DIR, "cbcap-county-map-2025.json"), `${JSON.stringify(countyMap)}\n`, "utf8"),
  ]);

  console.log(JSON.stringify({
    dashboardSummaryBytes: Buffer.byteLength(JSON.stringify(dashboardSummary)),
    countyMapBytes: Buffer.byteLength(JSON.stringify(countyMap)),
    countyCount: records.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "CB-CAP runtime snapshot generation failed");
  process.exitCode = 1;
});
