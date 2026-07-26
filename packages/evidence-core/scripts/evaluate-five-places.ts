import {
  AcsIngestionAdapter,
  AhrqClhIngestionAdapter,
  CdcPlacesIngestionAdapter,
  HRSA_HPSA_ARTIFACTS,
  HRSA_HPSA_COLUMNS,
  HrsaHpsaIngestionAdapter,
  InMemoryHttpCache,
  MILESTONE_2_EVALUATION_COUNTIES,
  type FetchLike,
  type Geography,
} from "../src/index.ts";

const now = new Date().toISOString();
const liveFetcher: FetchLike = async (url, init) => fetch(url, init) as never;
const cache = new InMemoryHttpCache();
const includeHrsa = process.argv.includes("--include-hrsa");

const cdc = new CdcPlacesIngestionAdapter({
  releaseLabel: "2025 release",
  releaseDate: "2025-12-04",
  dataPeriodByMeasure: {
    DIABETES: { start: "2023-01-01", end: "2023-12-31" },
    CHECKUP: { start: "2023-01-01", end: "2023-12-31" },
  },
});
const acs = new AcsIngestionAdapter({
  vintage: 2024,
  releaseDate: "2026-01-29",
  apiKey: process.env.CENSUS_API_KEY,
});
const hrsa = new HrsaHpsaIngestionAdapter({
  artifactUrl: HRSA_HPSA_ARTIFACTS.primaryCare,
  releaseDate: now.slice(0, 10),
  releaseLabel: `HPSA daily snapshot ${now.slice(0, 10)}`,
  columns: HRSA_HPSA_COLUMNS,
});
const ahrq = new AhrqClhIngestionAdapter({
  releaseLabel: "September 2025 release",
  releaseDate: "2025-09-01",
  artifactUrl: "https://www.ahrq.gov/sites/default/files/wysiwyg/sdoh/clh_2023_county_2_0.xlsx",
  geographyKind: "county",
  geographyIdField: "county_fips",
  variables: [],
});

async function safeBatch<T>(operation: () => Promise<T>) {
  try {
    return { ok: true as const, value: await operation() };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unknown source failure",
    };
  }
}

function countyGeography(place: (typeof MILESTONE_2_EVALUATION_COUNTIES)[number]): Geography {
  return {
    id: `evaluation-county-${place.countyFips}`,
    kind: "county",
    authority: "census",
    authorityId: place.countyFips,
    name: place.name,
    displayName: place.name,
    stateFips: place.stateFips,
    countyFips: place.countyFips,
    vintage: "2024",
    validFrom: null,
    validTo: null,
    reviewStatus: "verified",
    caveat: null,
  };
}

const places = [];
for (const place of MILESTONE_2_EVALUATION_COUNTIES) {
  const geography = countyGeography(place);
  const [cdcResult, acsResult, ahrqResult] = await Promise.all([
    safeBatch(() => cdc.fetch({ geography, requestedMeasureIds: ["DIABETES", "CHECKUP"] }, { fetcher: liveFetcher, cache, now })),
    safeBatch(() => acs.fetch({ geography }, { fetcher: liveFetcher, cache, now })),
    safeBatch(() => ahrq.fetch({ geography }, { fetcher: liveFetcher, cache, now })),
  ]);
  const hrsaResult = includeHrsa
    ? await safeBatch(() => hrsa.fetch({ geography }, { fetcher: liveFetcher, cache, now }))
    : null;
  places.push({
    place: place.name,
    countyFips: place.countyFips,
    cdcPlaces: cdcResult.ok ? {
      status: cdcResult.value.status,
      observations: cdcResult.value.observations.length,
      rejected: cdcResult.value.recordsRejected,
      releaseDate: cdcResult.value.sourceVersion?.releaseDate ?? null,
      dataPeriods: [...new Set(cdcResult.value.observations.map((observation) => `${observation.dataPeriodStart}/${observation.dataPeriodEnd}`))],
    } : { status: "failed", reason: cdcResult.error },
    acs: acsResult.ok ? {
      status: acsResult.value.status,
      observations: acsResult.value.observations.length,
      rejected: acsResult.value.recordsRejected,
      releaseDate: acsResult.value.sourceVersion?.releaseDate ?? null,
      dataPeriod: `${acsResult.value.sourceVersion?.dataPeriodStart ?? "unknown"}/${acsResult.value.sourceVersion?.dataPeriodEnd ?? "unknown"}`,
    } : { status: "failed", reason: acsResult.error },
    hrsa: hrsaResult?.ok
      ? {
          status: hrsaResult.value.status,
          wholeCountyPrimaryCareDesignations: hrsaResult.value.observations.length,
          releaseDate: hrsaResult.value.sourceVersion?.releaseDate ?? null,
        }
      : hrsaResult
        ? { status: "failed", reason: hrsaResult.error }
        : { status: "not_run", reason: "Pass --include-hrsa to download the current 35+ MB official daily artifact." },
    ahrqClh: ahrqResult.ok ? {
      status: ahrqResult.value.status,
      reason: ahrqResult.value.statusReason,
    } : { status: "failed", reason: ahrqResult.error },
  });
}

console.log(JSON.stringify({ evaluatedAt: now, grain: "exact Census county FIPS", places }, null, 2));
