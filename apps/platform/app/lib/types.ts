export type Interval = [number, number] | null;

export type Indicator = {
  value: number | null;
  ci: Interval;
};

export type ConditionIndicators = {
  highBloodPressure: Indicator;
  diabetes: Indicator;
  coronaryHeartDisease: Indicator;
  stroke: Indicator;
  cancer: Indicator;
  asthma: Indicator;
  copd: Indicator;
  depression: Indicator;
  obesity: Indicator;
};

export type BarrierIndicators = {
  uninsured: Indicator;
  transportation: Indicator;
  foodInsecurity: Indicator;
  housingInsecurity: Indicator;
  utilityShutoff: Indicator;
  loneliness: Indicator;
  disability: Indicator;
};

export type PreventionIndicators = {
  annualCheckup: Indicator;
  dentalVisit: Indicator;
  cholesterolScreening: Indicator;
  colorectalScreening: Indicator;
  mammography: Indicator;
};

export type PlanningMetrics = {
  chronicPercentile: number | null;
  barrierPercentile: number | null;
  preventionOpportunityPercentile: number | null;
  planningPressure: number | null;
};

export type CountyPlanningRecord = {
  fips: string;
  stateFips: string;
  countyFips: string;
  state: string;
  stateCode: string;
  county: string;
  centroid: { lat: number | null; lon: number | null };
  landSquareMiles: number | null;
  population: number | null;
  adultPopulation: number | null;
  conditions: ConditionIndicators;
  barriers: BarrierIndicators;
  prevention: PreventionIndicators;
  dataCoverage: number;
  sourceStatus: "available" | "not-available";
  planning: PlanningMetrics;
};

export type MetricGroup = "condition" | "barrier" | "prevention" | "planning";

export type MetricKey =
  | keyof ConditionIndicators
  | keyof BarrierIndicators
  | keyof PreventionIndicators
  | keyof PlanningMetrics
  | "population"
  | "dataCoverage";

export type MetricDefinition = {
  key: MetricKey;
  label: string;
  shortLabel: string;
  group: MetricGroup;
  unit: "percent" | "percentile" | "people" | "coverage";
  direction: "higher-is-more-need" | "higher-is-more-service" | "neutral";
  description: string;
};

export type GeographyKind = "state" | "county" | "place" | "locality" | "zcta";

export type GeographySuggestion = {
  id: string;
  kind: GeographyKind;
  label: string;
  context: string;
  geoid: string;
  stateFips: string;
};

export type GeographyProfile = {
  kind: GeographyKind;
  geoid: string;
  name: string;
  context: string;
  stateFips: string;
  population: number | null;
  adultPopulation: number | null;
  conditions: ConditionIndicators;
  barriers: BarrierIndicators;
  prevention: PreventionIndicators;
  dataCoverage: number;
  sourceStatus: "available" | "not-available";
  planning: PlanningMetrics;
};

export type BenchmarkProfile = {
  name: string;
  population: number;
  conditions: Record<keyof ConditionIndicators, number | null>;
  barriers: Record<keyof BarrierIndicators, number | null>;
  prevention: Record<keyof PreventionIndicators, number | null>;
};

export type ProfileResponse = {
  profile: GeographyProfile;
  stateBenchmark: BenchmarkProfile | null;
  nationalBenchmark: BenchmarkProfile;
  source: {
    label: string;
    url: string;
    released: string;
    modeledEstimateNotice: string;
  };
};

export type MapCountyRecord = {
  fips: string;
  stateFips: string;
  state: string;
  stateCode: string;
  county: string;
  population: number | null;
  dataCoverage: number;
  sourceStatus: CountyPlanningRecord["sourceStatus"];
  planningPressure: number | null;
  chronicPercentile: number | null;
  barrierPercentile: number | null;
  preventionOpportunityPercentile: number | null;
  diabetes: number | null;
  highBloodPressure: number | null;
  uninsured: number | null;
  transportation: number | null;
};

export type SourceManifest = {
  generatedAt: string;
  geography: {
    source: string;
    vintage: string;
    url: string;
    coverage: string;
    countyCount: number;
  };
  indicators: {
    source: string;
    datasetId: string;
    url: string;
    released: string;
    underlyingYears: string;
    rowCount: number;
    matchedCountyCount: number;
    modeledEstimateNotice: string;
  };
  demonstrationIndex: {
    label: string;
    status: string;
    formula: string;
    boundary: string;
  };
  quality: {
    expectedCountyEquivalents: number;
    actualCountyEquivalents: number;
    uniqueFips: number;
    unmatchedCdcRows: number;
    planningIndexAvailable: number;
    sha256: string;
  };
};

export type StateSummary = {
  fips: string;
  name: string;
  code: string;
  countyCount: number;
  population: number;
  dataCoverage: number;
  medianPlanningPressure: number | null;
};

export type DashboardResponse = {
  states: StateSummary[];
  nationalBenchmark: BenchmarkProfile;
  sources: SourceManifest;
  coverage: {
    countyCount: number;
    availableCountyCount: number;
    planningIndexAvailable: number;
    totalPopulation: number;
  };
};

export type CompactMapCountyRecord = [
  fips: string,
  county: string,
  population: number | null,
  dataCoverage: number,
  sourceAvailable: 0 | 1,
  planningPressure: number | null,
  chronicPercentile: number | null,
  barrierPercentile: number | null,
  preventionOpportunityPercentile: number | null,
  diabetes: number | null,
  highBloodPressure: number | null,
  uninsured: number | null,
  transportation: number | null,
];

export type CountyMapPayload = {
  version: 1;
  countyCount: number;
  sourceHash: string;
  records: CompactMapCountyRecord[];
};
