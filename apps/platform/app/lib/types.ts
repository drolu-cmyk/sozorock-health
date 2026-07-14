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

export type GeographyKind = "state" | "county" | "place" | "locality" | "community" | "zcta";

export type GeographyDataAvailability =
  | "derived-county-summary-available"
  | "official-modeled-estimates-available"
  | "official-geography-only"
  | "checked-on-selection";

export type GeographySourceReference = {
  agency: string;
  dataset: string;
  vintage: string;
  url: string;
  method: string;
  freshness: string;
  refreshedAt: string | null;
};

export type GeographyIdentifiers = {
  geoid: string;
  stateFips: string;
  countyFips: string | null;
  placeFips: string | null;
  zcta: string | null;
  gnisId?: string;
};

export type GeographySuggestion = {
  id: string;
  kind: GeographyKind;
  label: string;
  context: string;
  geoid: string;
  stateFips: string;
};

export type VerifiedGeographySuggestion = GeographySuggestion & {
  identifiers: GeographyIdentifiers;
  dataAvailability: GeographyDataAvailability;
  source: GeographySourceReference;
  profileSource: GeographySourceReference | null;
};

export type GeographySearchResponse = {
  query: string;
  results: VerifiedGeographySuggestion[];
  status: "ready" | "complete" | "partial" | "committed-only" | "unavailable";
  source: string;
  partial: boolean;
  remoteUnavailable: boolean;
  provenance: {
    committedStateCountySnapshot: GeographySourceReference;
    committedIndicatorSnapshot: GeographySourceReference;
    liveSubcountyLookup: GeographySourceReference;
    namedCommunityLookup: GeographySourceReference;
    coverage: {
      statesAndDistrictOfColumbia: number;
      countyEquivalents: number;
      subcountyGeographies: "Live authoritative lookup";
      namedCommunities: "Live authoritative lookup";
    };
    limitations: string[];
  };
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
  provenance: {
    evidenceStatus:
      | "official-source-estimates"
      | "derived-official-source-estimates"
      | "official-geography-only";
    geography: GeographySourceReference;
    indicators: GeographySourceReference | null;
    planning: {
      classification: "demonstration-model";
      available: boolean;
      label: string;
      method: string;
      boundary: string;
    };
    limitations: string[];
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

export type EvidenceIntegrationStatus =
  | "integrated-snapshot"
  | "integrated-on-demand"
  | "official-guidance"
  | "planned-ingestion";

export type EvidenceDomain =
  | "geography"
  | "population-health"
  | "community-conditions"
  | "workforce-capacity"
  | "shortage-designations"
  | "digital-connectivity"
  | "rural-context"
  | "planning-guidance";

export type EvidenceGeographyLevel =
  | "national"
  | "state"
  | "county"
  | "place"
  | "county-subdivision"
  | "community"
  | "census-tract"
  | "zcta"
  | "address";

export type EvidenceSourceRecord = {
  id: string;
  label: string;
  agency: string;
  domain: EvidenceDomain;
  evidenceClass:
    | "official-statistical-data"
    | "official-geography"
    | "official-designation"
    | "official-guidance";
  officialUrl: string;
  integrationStatus: EvidenceIntegrationStatus;
  geographyLevels: EvidenceGeographyLevel[];
  release: string;
  freshness: {
    checkedAt: string;
    cadence: string;
    snapshotGeneratedAt: string | null;
  };
  coverage: {
    scope: string;
    status:
      | "complete-national-snapshot"
      | "national-on-demand"
      | "official-reference"
      | "planned-not-displayed";
    numerator: number | null;
    denominator: number | null;
    unit: string | null;
  };
  purpose: string;
  limitations: string[];
};

export type BarrierTaxonomyRecord = {
  id: string;
  label: string;
  classification:
    | "pathway-barrier"
    | "accessibility-context"
    | "system-capacity-context";
  evidenceStatus: "displayed" | "planned-not-displayed";
  measureKeys: MetricKey[];
  sourceIds: string[];
  planningUse: string;
  boundary: string;
};

export type ChaChipStage = {
  id: "assess" | "validate" | "prioritize" | "act" | "measure";
  label: string;
  cbcapSupport: string;
  humanDecision: string;
};

export type WorkforceReadinessDimension = {
  id: string;
  label: string;
  status: "planned-not-displayed";
  sourceIds: string[];
  planningQuestion: string;
  boundary: string;
};

export type SystemIntelligenceCapability = {
  id: string;
  label: string;
  status: "current-foundation" | "bounded-scenario" | "planned-not-displayed";
  currentRelease: string;
  nextGovernedStep: string;
  boundary: string;
};

export type DerivedInsightTrace = {
  id: string;
  status: "source-estimate" | "derived-summary" | "bounded-scenario" | "planned-not-displayed";
  sourceIds: string[];
  method: string;
  limitations: string[];
  humanReview: string;
};

export type SystemsMaturityStage =
  | "Data Capture"
  | "Operational Execution"
  | "Structured Integration"
  | "Systems Intelligence"
  | "Institutional Intelligence";

export type SystemsMaturityTier = "Foundational" | "Integrative" | "Adaptive";

export type EvidenceRegistry = {
  version: string;
  verifiedAt: string;
  releaseBoundary: string;
  geographySearch: {
    statesAndDistrictOfColumbia: {
      count: number;
      status: "committed";
    };
    countyEquivalents: {
      count: number;
      status: "committed";
    };
    placesAndCities: {
      status: "authoritative-on-demand";
      includes: string[];
    };
    townsAndLocalities: {
      status: "authoritative-on-demand";
      includes: string[];
    };
    zipLinkedAreas: {
      status: "authoritative-on-demand";
      label: "Census ZCTA";
      boundary: string;
    };
  };
  sources: EvidenceSourceRecord[];
  barrierTaxonomy: BarrierTaxonomyRecord[];
  chaChipSupport: {
    sourceId: string;
    boundary: string;
    stages: ChaChipStage[];
  };
  workforceReadiness: {
    status: "architecture-ready-data-not-integrated";
    boundary: string;
    dimensions: WorkforceReadinessDimension[];
  };
  systemsIntelligence: {
    framing: string;
    boundary: string;
    traceability: {
      sequence: ["Evidence", "Interpretation", "Lever"];
      rule: string;
      requiredDerivedInsightFields: (keyof DerivedInsightTrace)[];
    };
    maturityModel: {
      stages: SystemsMaturityStage[];
      tiers: SystemsMaturityTier[];
      currentPublicRelease: SystemsMaturityStage;
      boundary: string;
    };
    operatingComponents: {
      id: string;
      label: string;
      status: "current-foundation" | "bounded-scenario" | "planned-not-displayed";
      boundary: string;
    }[];
    capabilities: SystemIntelligenceCapability[];
  };
  scenarioPolicy: {
    classification: "bounded-planning-scenario";
    allowed: string[];
    prohibited: string[];
    humanReview: string;
  };
};
