import "server-only";

import countyData from "../../data/county-planning.json";
import manifestData from "../../data/source-manifest.json";
import {
  cdcBarrierFields,
  cdcConditionFields,
  cdcPreventionFields,
  cdcProfileFieldsByKind,
} from "./cdc-profile-contract";
import type {
  BarrierIndicators,
  BenchmarkProfile,
  ConditionIndicators,
  CountyPlanningRecord,
  GeographyProfile,
  MapCountyRecord,
  PreventionIndicators,
  SourceManifest,
} from "./types";
import { repairPublicDataText } from "./text-normalization";

export const counties = countyData as CountyPlanningRecord[];
export const sourceManifest = manifestData as SourceManifest;

export const states = [...new Map(
  counties.map((county) => [county.stateFips, {
    fips: county.stateFips,
    name: county.state,
    code: county.stateCode,
  }]),
).values()].sort((a, b) => a.name.localeCompare(b.name));

export const countiesByFips = new Map(counties.map((county) => [county.fips, county]));

export const mapCounties: MapCountyRecord[] = counties.map((county) => ({
  fips: county.fips,
  stateFips: county.stateFips,
  state: county.state,
  stateCode: county.stateCode,
  county: county.county,
  population: county.population,
  dataCoverage: county.dataCoverage,
  sourceStatus: county.sourceStatus,
  planningPressure: county.planning.planningPressure,
  chronicPercentile: county.planning.chronicPercentile,
  barrierPercentile: county.planning.barrierPercentile,
  preventionOpportunityPercentile: county.planning.preventionOpportunityPercentile,
  diabetes: county.conditions.diabetes.value,
  highBloodPressure: county.conditions.highBloodPressure.value,
  uninsured: county.barriers.uninsured.value,
  transportation: county.barriers.transportation.value,
}));

function weightedValue<T extends Record<string, { value: number | null }>>(
  records: CountyPlanningRecord[],
  group: (record: CountyPlanningRecord) => T,
  key: keyof T,
) {
  let numerator = 0;
  let denominator = 0;
  for (const record of records) {
    const value = group(record)[key].value;
    const population = record.adultPopulation ?? record.population;
    if (value === null || population === null || population <= 0) continue;
    numerator += value * population;
    denominator += population;
  }
  return denominator ? Math.round((numerator / denominator) * 10) / 10 : null;
}

const conditionKeys: (keyof ConditionIndicators)[] = [
  "highBloodPressure", "diabetes", "coronaryHeartDisease", "stroke", "cancer",
  "asthma", "copd", "depression", "obesity",
];
const allBarrierKeys: (keyof BarrierIndicators)[] = [
  "uninsured", "transportation", "foodInsecurity", "housingInsecurity",
  "utilityShutoff", "loneliness", "disability",
];
const planningBarrierKeys: (keyof BarrierIndicators)[] = [
  "uninsured", "transportation", "foodInsecurity", "housingInsecurity",
  "utilityShutoff", "loneliness",
];
const minimumPlanningBarrierMeasures = 2;
const preventionKeys: (keyof PreventionIndicators)[] = [
  "annualCheckup", "dentalVisit", "cholesterolScreening", "colorectalScreening", "mammography",
];

export function benchmarkFor(records: CountyPlanningRecord[], name: string): BenchmarkProfile {
  return {
    name,
    population: records.reduce((sum, record) => sum + (record.population ?? 0), 0),
    conditions: Object.fromEntries(conditionKeys.map((key) => [
      key,
      weightedValue(records, (record) => record.conditions, key),
    ])) as BenchmarkProfile["conditions"],
    barriers: Object.fromEntries(allBarrierKeys.map((key) => [
      key,
      weightedValue(records, (record) => record.barriers, key),
    ])) as BenchmarkProfile["barriers"],
    prevention: Object.fromEntries(preventionKeys.map((key) => [
      key,
      weightedValue(records, (record) => record.prevention, key),
    ])) as BenchmarkProfile["prevention"],
  };
}

export const nationalBenchmark = benchmarkFor(counties, "United States county benchmark");

export const stateBenchmarks = new Map(
  states.map((state) => [
    state.fips,
    benchmarkFor(
      counties.filter((county) => county.stateFips === state.fips),
      `${state.name} county benchmark`,
    ),
  ]),
);

export { cdcProfileFieldsByKind };

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function interval(value: unknown): [number, number] | null {
  if (typeof value !== "string") return null;
  const numbers = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  return numbers.length >= 2 && numbers.every(Number.isFinite)
    ? [numbers[0], numbers[1]]
    : null;
}

function groupFromRow<T extends Record<string, [string, string]>>(
  row: Record<string, unknown>,
  fields: T,
) {
  return Object.fromEntries(Object.entries(fields).map(([key, [valueField, intervalField]]) => [
    key,
    { value: numeric(row[valueField]), ci: interval(row[intervalField]) },
  ])) as { [K in keyof T]: { value: number | null; ci: [number, number] | null } };
}

function average(values: (number | null)[]) {
  const available = values.filter((value): value is number => value !== null);
  return available.length
    ? available.reduce((sum, value) => sum + value, 0) / available.length
    : null;
}

function planningBarrierAverage(barriers: BarrierIndicators) {
  const values = planningBarrierKeys
    .map((key) => barriers[key].value)
    .filter((value): value is number => value !== null);
  return values.length >= minimumPlanningBarrierMeasures ? average(values) : null;
}

export function median(values: (number | null)[]) {
  const available = values
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (!available.length) return null;
  const middle = Math.floor(available.length / 2);
  return available.length % 2
    ? available[middle]
    : Math.round((available[middle - 1] + available[middle]) / 2);
}

function percentileAgainst(value: number | null, distribution: number[]) {
  if (value === null || !distribution.length) return null;
  const count = distribution.filter((candidate) => candidate <= value).length;
  return Math.round((count / distribution.length) * 100);
}

const chronicDistribution = counties
  .map((county) => average(conditionKeys.map((key) => county.conditions[key].value)))
  .filter((value): value is number => value !== null)
  .sort((a, b) => a - b);
const barrierDistribution = counties
  .map((county) => planningBarrierAverage(county.barriers))
  .filter((value): value is number => value !== null)
  .sort((a, b) => a - b);
const preventionGapDistribution = counties
  .map((county) => average(preventionKeys.map((key) => {
    const value = county.prevention[key].value;
    return value === null ? null : 100 - value;
  })))
  .filter((value): value is number => value !== null)
  .sort((a, b) => a - b);

export function profileFromCdcRow(
  kind: "place" | "zcta",
  geoid: string,
  requestedName: string,
  row: Record<string, unknown>,
  stateFips = "",
): GeographyProfile {
  const conditions = groupFromRow(row, cdcConditionFields) as ConditionIndicators;
  const barriers = groupFromRow(row, cdcBarrierFields) as BarrierIndicators;
  const prevention = groupFromRow(row, cdcPreventionFields) as PreventionIndicators;
  const chronicPercentile = percentileAgainst(
    average(conditionKeys.map((key) => conditions[key].value)),
    chronicDistribution,
  );
  const barrierPercentile = percentileAgainst(
    planningBarrierAverage(barriers),
    barrierDistribution,
  );
  const preventionOpportunityPercentile = percentileAgainst(
    average(preventionKeys.map((key) => {
      const value = prevention[key].value;
      return value === null ? null : 100 - value;
    })),
    preventionGapDistribution,
  );
  const components = [
    chronicPercentile === null ? null : { value: chronicPercentile, weight: 0.45 },
    barrierPercentile === null ? null : { value: barrierPercentile, weight: 0.35 },
    preventionOpportunityPercentile === null
      ? null
      : { value: preventionOpportunityPercentile, weight: 0.2 },
  ].filter((value): value is { value: number; weight: number } => value !== null);
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const planningPressure = components.length >= 2 && totalWeight
    ? Math.round(components.reduce((sum, component) => sum + component.value * component.weight, 0) / totalWeight)
    : null;
  const allIndicators = [
    ...Object.values(conditions), ...Object.values(barriers), ...Object.values(prevention),
  ];
  const available = allIndicators.filter((metric) => metric.value !== null).length;
  const stateName = typeof row.statedesc === "string" ? row.statedesc : "";
  const resolvedName = kind === "place"
    ? repairPublicDataText(String(row.locationname ?? row.placename ?? requestedName))
    : `ZIP-linked area ${String(row.zcta5 ?? geoid)}`;
  return {
    kind,
    geoid,
    name: resolvedName,
    context: kind === "place"
      ? `${stateName || "United States"} · Census place GEOID ${geoid}`
      : "Census ZIP Code Tabulation Area (ZCTA); not a USPS delivery route",
    stateFips,
    population: numeric(row.totalpopulation),
    adultPopulation: numeric(row.totalpop18plus),
    conditions,
    barriers,
    prevention,
    dataCoverage: Math.round((available / allIndicators.length) * 100),
    sourceStatus: available ? "available" : "not-available",
    planning: {
      chronicPercentile,
      barrierPercentile,
      preventionOpportunityPercentile,
      planningPressure,
    },
  };
}

export function profileForState(stateFips: string) {
  const state = states.find((candidate) => candidate.fips === stateFips);
  if (!state) return null;
  const records = counties.filter((county) => county.stateFips === stateFips);
  const benchmark = stateBenchmarks.get(stateFips);
  if (!benchmark) return null;
  const indicator = (value: number | null) => ({ value, ci: null });
  const planning = {
    chronicPercentile: median(records.map((record) => record.planning.chronicPercentile)),
    barrierPercentile: median(records.map((record) => record.planning.barrierPercentile)),
    preventionOpportunityPercentile: median(records.map((record) => record.planning.preventionOpportunityPercentile)),
    planningPressure: median(records.map((record) => record.planning.planningPressure)),
  };
  return {
    kind: "state",
    geoid: state.fips,
    name: state.name,
    context: `${records.length.toLocaleString("en-US")} county equivalents · State FIPS ${state.fips}`,
    stateFips: state.fips,
    population: benchmark.population,
    adultPopulation: records.reduce((sum, record) => sum + (record.adultPopulation ?? 0), 0),
    conditions: Object.fromEntries(conditionKeys.map((key) => [key, indicator(benchmark.conditions[key])])) as ConditionIndicators,
    barriers: Object.fromEntries(allBarrierKeys.map((key) => [key, indicator(benchmark.barriers[key])])) as BarrierIndicators,
    prevention: Object.fromEntries(preventionKeys.map((key) => [key, indicator(benchmark.prevention[key])])) as PreventionIndicators,
    dataCoverage: Math.round(average(records.map((record) => record.dataCoverage)) ?? 0),
    sourceStatus: records.some((record) => record.sourceStatus === "available") ? "available" : "not-available",
    planning,
  } satisfies GeographyProfile;
}

export function countyToProfile(county: CountyPlanningRecord): GeographyProfile {
  return {
    kind: "county",
    geoid: county.fips,
    name: county.county,
    context: `${county.state} · County FIPS ${county.fips}`,
    stateFips: county.stateFips,
    population: county.population,
    adultPopulation: county.adultPopulation,
    conditions: county.conditions,
    barriers: county.barriers,
    prevention: county.prevention,
    dataCoverage: county.dataCoverage,
    sourceStatus: county.sourceStatus,
    planning: county.planning,
  };
}

export function emptyProfile(
  kind: GeographyProfile["kind"],
  geoid: string,
  name: string,
  context: string,
  stateFips = "",
): GeographyProfile {
  const indicator = { value: null, ci: null };
  return {
    kind,
    geoid,
    name,
    context,
    stateFips,
    population: null,
    adultPopulation: null,
    conditions: Object.fromEntries(conditionKeys.map((key) => [key, indicator])) as ConditionIndicators,
    barriers: Object.fromEntries(allBarrierKeys.map((key) => [key, indicator])) as BarrierIndicators,
    prevention: Object.fromEntries(preventionKeys.map((key) => [key, indicator])) as PreventionIndicators,
    dataCoverage: 0,
    sourceStatus: "not-available",
    planning: {
      chronicPercentile: null,
      barrierPercentile: null,
      preventionOpportunityPercentile: null,
      planningPressure: null,
    },
  };
}
