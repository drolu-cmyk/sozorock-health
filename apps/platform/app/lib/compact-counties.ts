import type {
  CountyMapPayload,
  MapCountyRecord,
  StateSummary,
} from "./types";

export function inflateCountyMap(
  payload: CountyMapPayload,
  states: StateSummary[],
): MapCountyRecord[] {
  if (payload.version !== 1 || payload.countyCount !== 3144 || payload.records.length !== 3144) {
    throw new Error("The nationwide county snapshot is incomplete");
  }
  const stateByFips = new Map(states.map((state) => [state.fips, state]));
  const fipsSeen = new Set<string>();
  const records = payload.records.map((compact) => {
    const [
      fips, county, population, dataCoverage, sourceAvailable, planningPressure,
      chronicPercentile, barrierPercentile, preventionOpportunityPercentile,
      diabetes, highBloodPressure, uninsured, transportation,
    ] = compact;
    const stateFips = fips.slice(0, 2);
    const state = stateByFips.get(stateFips);
    if (!/^\d{5}$/.test(fips) || fipsSeen.has(fips) || !state) {
      throw new Error("The nationwide county snapshot contains invalid geography metadata");
    }
    fipsSeen.add(fips);
    return {
      fips,
      stateFips,
      state: state.name,
      stateCode: state.code,
      county,
      population,
      dataCoverage,
      sourceStatus: sourceAvailable === 1 ? "available" : "not-available",
      planningPressure,
      chronicPercentile,
      barrierPercentile,
      preventionOpportunityPercentile,
      diabetes,
      highBloodPressure,
      uninsured,
      transportation,
    } satisfies MapCountyRecord;
  });
  return records;
}
