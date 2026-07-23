import {
  buildCountyPlaceBrief,
  type CountyEvidenceSnapshot,
  type CountyEvidenceSnapshotRecord,
  type ExplorePlaceBriefV1,
} from "@sozorock/evidence-core";
import snapshotJson from "../../../../packages/evidence-core/data/national/county-evidence-snapshot.v1.json";

export const approvedCountyEvidenceSnapshot = snapshotJson as CountyEvidenceSnapshot;
export const countyRecordByFips = new Map(
  approvedCountyEvidenceSnapshot.counties.map((record) => [record.fips, record]),
);

type Group = "conditions" | "barriers" | "prevention";
type Benchmark = Record<Group, Record<string, number | null>>;

function benchmark(records: CountyEvidenceSnapshotRecord[]): Benchmark {
  const output: Benchmark = { conditions: {}, barriers: {}, prevention: {} };
  for (const group of Object.keys(output) as Group[]) {
    const fields = new Set(records.flatMap((record) => Object.keys(record[group])));
    for (const field of fields) {
      let numerator = 0;
      let denominator = 0;
      for (const record of records) {
        const value = record[group][field]?.value;
        const population = record.adultPopulation ?? record.population;
        if (value === null || value === undefined || !population || population <= 0) continue;
        numerator += value * population;
        denominator += population;
      }
      output[group][field] = denominator ? Number((numerator / denominator).toFixed(1)) : null;
    }
  }
  return output;
}

export const nationalCountyBenchmark = benchmark(approvedCountyEvidenceSnapshot.counties);
const stateBenchmarks = new Map<string, Benchmark>();
export function stateCountyBenchmark(stateCode: string) {
  const existing = stateBenchmarks.get(stateCode);
  if (existing) return existing;
  const calculated = benchmark(approvedCountyEvidenceSnapshot.counties.filter((record) => record.stateCode === stateCode));
  stateBenchmarks.set(stateCode, calculated);
  return calculated;
}

export function getApprovedCountyBrief(geoid: string): ExplorePlaceBriefV1 | null {
  const record = countyRecordByFips.get(geoid);
  if (!record) return null;
  const brief = buildCountyPlaceBrief(record, approvedCountyEvidenceSnapshot, geoid);
  if (process.env.EVIDENCE_SOURCE_CDC_PLACES_ENABLED === "false") {
    brief.publicData.observations = [];
    brief.publicData.sources = [];
    brief.citations = [];
    const coverage = brief.publicData.sourceCoverage.find((item) => item.sourceId === "cdc-places");
    if (coverage) {
      coverage.status = "ingestion_failed";
      coverage.reason = "CDC PLACES is disabled by the emergency capability switch; the last approved geography snapshot remains active.";
      coverage.sourceVersionId = null;
      coverage.observationCount = 0;
    }
  }
  return brief;
}
