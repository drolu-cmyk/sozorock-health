import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "apps", "platform", "data");
const TIGER_COUNTIES =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query";
const TIGER_STATES =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0/query";
const CDC_DATASET_ID = "i46a-9kgh";
const CDC_DATASET_URL = `https://data.cdc.gov/resource/${CDC_DATASET_ID}.json`;
const CDC_LANDING_URL =
  "https://data.cdc.gov/500-Cities-Places/PLACES-County-Data-GIS-Friendly-Format-2025-releas/i46a-9kgh";

const INCLUDED_STATE_FIPS = new Set([
  "01", "02", "04", "05", "06", "08", "09", "10", "11", "12", "13",
  "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25",
  "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36",
  "37", "38", "39", "40", "41", "42", "44", "45", "46", "47", "48",
  "49", "50", "51", "53", "54", "55", "56",
]);

const CONDITION_FIELDS = {
  highBloodPressure: ["bphigh_crudeprev", "bphigh_crude95ci"],
  diabetes: ["diabetes_crudeprev", "diabetes_crude95ci"],
  coronaryHeartDisease: ["chd_crudeprev", "chd_crude95ci"],
  stroke: ["stroke_crudeprev", "stroke_crude95ci"],
  cancer: ["cancer_crudeprev", "cancer_crude95ci"],
  asthma: ["casthma_crudeprev", "casthma_crude95ci"],
  copd: ["copd_crudeprev", "copd_crude95ci"],
  depression: ["depression_crudeprev", "depression_crude95ci"],
  obesity: ["obesity_crudeprev", "obesity_crude95ci"],
};

const BARRIER_FIELDS = {
  uninsured: ["access2_crudeprev", "access2_crude95ci"],
  transportation: ["lacktrpt_crudeprev", "lacktrpt_crude95ci"],
  foodInsecurity: ["foodinsecu_crudeprev", "foodinsecu_crude95ci"],
  housingInsecurity: ["housinsecu_crudeprev", "housinsecu_crude95ci"],
  utilityShutoff: ["shututility_crudeprev", "shututility_crude95ci"],
  loneliness: ["loneliness_crudeprev", "loneliness_crude95ci"],
  disability: ["disability_crudeprev", "disability_crude95ci"],
};

// Disability is retained as accessibility context in the source record. It is
// deliberately excluded from pathway-barrier and composite calculations.
const PLANNING_BARRIER_KEYS = Object.freeze([
  "uninsured",
  "transportation",
  "foodInsecurity",
  "housingInsecurity",
  "utilityShutoff",
  "loneliness",
]);
const MIN_PLANNING_BARRIER_MEASURES = 2;

const PREVENTION_FIELDS = {
  annualCheckup: ["checkup_crudeprev", "checkup_crude95ci"],
  dentalVisit: ["dental_crudeprev", "dental_crude95ci"],
  cholesterolScreening: ["cholscreen_crudeprev", "cholscreen_crude95ci"],
  colorectalScreening: ["colon_screen_crudeprev", "colon_screen_crude95ci"],
  mammography: ["mammouse_crudeprev", "mammouse_crude95ci"],
};

const selectedCdcFields = [
  "stateabbr", "statedesc", "countyname", "countyfips", "totalpopulation",
  "totalpop18plus",
  ...Object.values(CONDITION_FIELDS).flat(),
  ...Object.values(BARRIER_FIELDS).flat(),
  ...Object.values(PREVENTION_FIELDS).flat(),
];

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SozoRock-CB-CAP-Data-Pipeline/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new Error(`Expected JSON but received ${contentType || "unknown content"}`);
  }
  return response.json();
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function signedNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function intervalOrNull(value) {
  if (typeof value !== "string") return null;
  const numbers = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length < 2 || numbers.some((item) => !Number.isFinite(item))) {
    return null;
  }
  return [numbers[0], numbers[1]];
}

function metricGroup(row, fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, [estimateField, intervalField]]) => [
      key,
      {
        value: numberOrNull(row?.[estimateField]),
        ci: intervalOrNull(row?.[intervalField]),
      },
    ]),
  );
}

function availableValues(group) {
  return Object.values(group)
    .map((metric) => metric.value)
    .filter((value) => value !== null);
}

function availableValuesForKeys(group, keys) {
  return keys
    .map((key) => group[key]?.value ?? null)
    .filter((value) => value !== null);
}

function planningBarrierMean(group) {
  const values = availableValuesForKeys(group, PLANNING_BARRIER_KEYS);
  return values.length >= MIN_PLANNING_BARRIER_MEASURES ? mean(values) : null;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(value, orderedValues) {
  if (value === null || !orderedValues.length) return null;
  let lowerOrEqual = 0;
  for (const candidate of orderedValues) {
    if (candidate <= value) lowerOrEqual += 1;
    else break;
  }
  return Math.round((lowerOrEqual / orderedValues.length) * 100);
}

function round(value, digits = 1) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const tigerParams = new URLSearchParams({
    f: "json",
    where: "1=1",
    outFields: "GEOID,STATE,COUNTY,NAME,BASENAME,CENTLAT,CENTLON,AREALAND,AREAWATER",
    returnGeometry: "false",
    orderByFields: "GEOID",
    resultRecordCount: "10000",
  });
  const tiger = await fetchJson(`${TIGER_COUNTIES}?${tigerParams}`);
  const counties = (tiger.features ?? [])
    .map((feature) => feature.attributes ?? {})
    .filter((attributes) => INCLUDED_STATE_FIPS.has(String(attributes.STATE).padStart(2, "0")));

  const stateParams = new URLSearchParams({
    f: "json",
    where: "1=1",
    outFields: "GEOID,NAME,STUSAB",
    returnGeometry: "false",
    orderByFields: "GEOID",
    resultRecordCount: "100",
  });
  const tigerStates = await fetchJson(`${TIGER_STATES}?${stateParams}`);
  const stateMetadataByFips = new Map(
    (tigerStates.features ?? [])
      .map((feature) => feature.attributes ?? {})
      .filter((attributes) => INCLUDED_STATE_FIPS.has(String(attributes.GEOID).padStart(2, "0")))
      .map((attributes) => [String(attributes.GEOID).padStart(2, "0"), attributes]),
  );

  const cdcParams = new URLSearchParams({
    $limit: "5000",
    $select: selectedCdcFields.join(","),
    $order: "countyfips",
  });
  const cdcRows = await fetchJson(`${CDC_DATASET_URL}?${cdcParams}`);
  const cdcByFips = new Map(
    cdcRows.map((row) => [String(row.countyfips).padStart(5, "0"), row]),
  );

  const preliminary = counties.map((county) => {
    const fips = String(county.GEOID).padStart(5, "0");
    const stateFips = String(county.STATE).padStart(2, "0");
    const row = cdcByFips.get(fips) ?? null;
    const stateMetadata = stateMetadataByFips.get(stateFips) ?? null;
    const conditions = metricGroup(row, CONDITION_FIELDS);
    const barriers = metricGroup(row, BARRIER_FIELDS);
    const prevention = metricGroup(row, PREVENTION_FIELDS);
    const coverageMetrics = [
      ...Object.values(conditions),
      ...Object.values(barriers),
      ...Object.values(prevention),
    ];
    const covered = coverageMetrics.filter((metric) => metric.value !== null).length;
    return {
      fips,
      stateFips,
      countyFips: String(county.COUNTY).padStart(3, "0"),
      state: row?.statedesc ?? stateMetadata?.NAME ?? "",
      stateCode: row?.stateabbr ?? stateMetadata?.STUSAB ?? "",
      county: String(county.NAME ?? county.BASENAME ?? row?.countyname ?? "County"),
      centroid: {
        lat: signedNumberOrNull(county.CENTLAT),
        lon: signedNumberOrNull(county.CENTLON),
      },
      landSquareMiles: round(numberOrNull(county.AREALAND) === null ? null : Number(county.AREALAND) / 2_589_988.110336),
      population: numberOrNull(row?.totalpopulation),
      adultPopulation: numberOrNull(row?.totalpop18plus),
      conditions,
      barriers,
      prevention,
      dataCoverage: Math.round((covered / coverageMetrics.length) * 100),
      sourceStatus: row ? "available" : "not-available",
      planning: {
        chronicPercentile: null,
        barrierPercentile: null,
        preventionOpportunityPercentile: null,
        planningPressure: null,
      },
    };
  });

  const chronicMeans = preliminary
    .map((county) => mean(availableValues(county.conditions)))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
  const barrierMeans = preliminary
    .map((county) => planningBarrierMean(county.barriers))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
  const preventionGaps = preliminary
    .map((county) => {
      const values = availableValues(county.prevention).map((value) => 100 - value);
      return mean(values);
    })
    .filter((value) => value !== null)
    .sort((a, b) => a - b);

  const records = preliminary.map((county) => {
    const chronicMean = mean(availableValues(county.conditions));
    const barrierMean = planningBarrierMean(county.barriers);
    const preventionGap = mean(
      availableValues(county.prevention).map((value) => 100 - value),
    );
    const chronicPercentile = percentile(chronicMean, chronicMeans);
    const barrierPercentile = percentile(barrierMean, barrierMeans);
    const preventionOpportunityPercentile = percentile(preventionGap, preventionGaps);
    const components = [
      chronicPercentile === null ? null : { value: chronicPercentile, weight: 0.45 },
      barrierPercentile === null ? null : { value: barrierPercentile, weight: 0.35 },
      preventionOpportunityPercentile === null
        ? null
        : { value: preventionOpportunityPercentile, weight: 0.2 },
    ].filter(Boolean);
    const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
    const planningPressure = components.length >= 2 && totalWeight
      ? Math.round(
          components.reduce(
            (sum, component) => sum + component.value * component.weight,
            0,
          ) / totalWeight,
        )
      : null;
    return {
      ...county,
      planning: {
        chronicPercentile,
        barrierPercentile,
        preventionOpportunityPercentile,
        planningPressure,
      },
    };
  });

  const dataJson = `${JSON.stringify(records)}\n`;
  const manifest = {
    generatedAt: new Date().toISOString(),
    geography: {
      source: "U.S. Census Bureau TIGERweb",
      vintage: "January 1, 2025",
      url: "https://tigerweb.geo.census.gov/",
      coverage: "50 states and the District of Columbia",
      countyCount: records.length,
    },
    indicators: {
      source: "CDC PLACES: County Data (GIS Friendly Format), 2025 release",
      datasetId: CDC_DATASET_ID,
      url: CDC_LANDING_URL,
      released: "December 4, 2025",
      underlyingYears: "BRFSS 2023/2022, Census 2023, ACS 2019-2023/2018-2022",
      rowCount: cdcRows.length,
      matchedCountyCount: records.filter((record) => record.sourceStatus === "available").length,
      modeledEstimateNotice:
        "CDC PLACES values are model-based population estimates, not diagnoses or counts of individual people.",
    },
    demonstrationIndex: {
      label: "CB-CAP demonstration planning pressure",
      status: "planning-scenario-only",
      formula:
        "45% chronic-condition percentile + 35% pathway-barrier percentile + 20% prevention-opportunity percentile. The pathway-barrier percentile uses adult estimates for lack of health insurance, lack of reliable transportation, food insecurity, housing insecurity, utility shutoff or threat, and loneliness, and requires at least two eligible pathway-barrier measures. Disability is retained only as accessibility context and is excluded from pathway-barrier and composite calculations. At least two top-level components are required; one missing component is reweighted.",
      boundary:
        "Not a government designation, clinical risk score, funding formula, or prediction of individual health outcomes.",
    },
    quality: {
      expectedCountyEquivalents: 3144,
      actualCountyEquivalents: records.length,
      uniqueFips: new Set(records.map((record) => record.fips)).size,
      unmatchedCdcRows: cdcRows.filter(
        (row) => !records.some((record) => record.fips === String(row.countyfips).padStart(5, "0")),
      ).length,
      planningIndexAvailable: records.filter(
        (record) => record.planning.planningPressure !== null,
      ).length,
      sha256: sha256(dataJson),
    },
  };

  if (manifest.quality.actualCountyEquivalents !== 3144) {
    throw new Error(
      `Expected 3,144 county equivalents; received ${manifest.quality.actualCountyEquivalents}`,
    );
  }
  if (records.some((record) => !record.state || !record.stateCode)) {
    throw new Error("Every county equivalent must retain Census state name and abbreviation metadata");
  }
  if (records.some((record) => record.centroid.lat === null || record.centroid.lon === null)) {
    throw new Error("Every county equivalent must retain a Census centroid");
  }
  if (manifest.quality.uniqueFips !== records.length) {
    throw new Error("County FIPS values are not unique");
  }
  if (records.some((record) => !/^\d{5}$/.test(record.fips))) {
    throw new Error("Invalid county FIPS value found");
  }

  await writeFile(path.join(DATA_DIR, "county-planning.json"), dataJson, "utf8");
  await writeFile(
    path.join(DATA_DIR, "source-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        counties: records.length,
        cdcRows: cdcRows.length,
        matched: manifest.indicators.matchedCountyCount,
        coverage: manifest.geography.coverage,
        sha256: manifest.quality.sha256,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "CB-CAP refresh failed");
  process.exitCode = 1;
});
