import {
  buildCountyPlaceBrief,
  deterministicUuid,
  type CountyEvidenceSnapshot,
  type CountyEvidenceSnapshotRecord,
  type ExplorePlaceBriefV1,
} from "@sozorock/evidence-core";
import snapshotJson from "../../../../packages/evidence-core/data/national/county-evidence-snapshot.v1.json";
import acsContextJson from "../../../../packages/evidence-core/data/national/acs-county-context.v1.json";
import hrsaContextJson from "../../../../packages/evidence-core/data/national/hrsa-county-context.v1.json";
import ahrfContextJson from "../../../../packages/evidence-core/data/national/ahrf-county-context.v1.json";
import ahrqContextJson from "../../../../packages/evidence-core/data/national/ahrq-clh-county-context.v1.json";
import localPlanDirectoryJson from "../../../../packages/evidence-core/data/national/local-plan-coverage-directory.v1.json";

export const approvedCountyEvidenceSnapshot = snapshotJson as CountyEvidenceSnapshot;
export const countyRecordByFips = new Map(
  approvedCountyEvidenceSnapshot.counties.map((record) => [record.fips, record]),
);
const localPlanDirectory = localPlanDirectoryJson as {
  counties: Array<{
    countyGeoid: string;
    discoveryStatus: string;
    verificationStatus: string;
    publicationCoverageStatus: string;
    candidates: Array<{
      id: string;
      title: string;
      publisher: string;
      sourcePageUrl: string;
      artifactUrl: string;
      documentType: "cha" | "chip" | "chna" | "csp" | "implementation_strategy" | "supporting_report";
      coverageScope: string;
      publicationDate: string | null;
      reviewStatus: "provisional";
    }>;
  }>;
};
const localPlanByCounty = new Map(localPlanDirectory.counties.map((county) => [county.countyGeoid, county]));
export type AcsCountyContext = {
  population: number | null;
  populationMoe: number | null;
  medianAge: number | null;
  medianAgeMoe: number | null;
  povertyPercent: number | null;
  povertyPercentMoe: number | null;
  noVehiclePercent: number | null;
  noVehiclePercentMoe: number | null;
  internetSubscriptionPercent: number | null;
  internetSubscriptionPercentMoe: number | null;
};
const acsContext = acsContextJson as {
  generatedAt: string;
  source: {
    publisher: string;
    title: string;
    officialUrl: string;
    releaseDate: string;
    dataPeriod: { start: string; end: string };
  };
  sourceArtifacts: Array<{ sha256: string }>;
  records: Record<string, AcsCountyContext>;
};
export const acsCountySource = acsContext.source;

export function getAcsCountyContext(geoid: string): AcsCountyContext {
  return acsContext.records[geoid] ?? {
    population: null,
    populationMoe: null,
    medianAge: null,
    medianAgeMoe: null,
    povertyPercent: null,
    povertyPercentMoe: null,
    noVehiclePercent: null,
    noVehiclePercentMoe: null,
    internetSubscriptionPercent: null,
    internetSubscriptionPercentMoe: null,
  };
}
export type HrsaCountyContext = {
  hpsa: Array<{
    designationId: string;
    designationName: string;
    designationType: string;
    componentType: string;
    discipline: string;
    status: string;
    score: number | null;
    designationDate: string | null;
    lastUpdateDate: string | null;
    wholeCounty: boolean;
  }>;
  muaP: Array<{
    designationId: string;
    designationName: string;
    designationType: string;
    componentType: string;
    populationType: string;
    status: string;
    imuScore: number | null;
    designationDate: string | null;
    lastUpdateDate: string | null;
    wholeCounty: boolean;
  }>;
};
const hrsaContext = hrsaContextJson as {
  generatedAt: string;
  officialUrl: string;
  manifests: Array<{ sha256: string }>;
  counties: Record<string, HrsaCountyContext>;
};

export function getHrsaCountyContext(geoid: string): HrsaCountyContext {
  return hrsaContext.counties[geoid] ?? { hpsa: [], muaP: [] };
}
export type AhrfCountyContext = {
  observations: Array<{
    variableId: string;
    label: string;
    value: number | null;
    unit: string;
    year: string;
    direction: string;
  }>;
};
const ahrfContext = ahrfContextJson as {
  generatedAt: string;
  officialUrl: string;
  title: string;
  releaseDate: string;
  dataPeriods: string[];
  manifests: { data: { sha256: string }; documentation: { sha256: string } };
  counties: Record<string, AhrfCountyContext>;
};

export function getAhrfCountyContext(geoid: string): AhrfCountyContext {
  return ahrfContext.counties[geoid] ?? { observations: [] };
}
export type AhrqCountyContext = {
  observations: Array<{
    variableId: string;
    label: string;
    value: string | number | null;
    unit: string;
    dataPeriod: string;
    direction: string;
    originalSource: string;
    domain: string;
    topic: string;
    uncertainty: null;
  }>;
};
const ahrqContext = ahrqContextJson as {
  generatedAt: string;
  publisher: string;
  title: string;
  officialUrl: string;
  releaseDate: string;
  fileYear: string;
  manifests: { data: { sha256: string }; codebook: { sha256: string } };
  counties: Record<string, AhrqCountyContext>;
};

export function getAhrqCountyContext(geoid: string): AhrqCountyContext {
  return ahrqContext.counties[geoid] ?? { observations: [] };
}

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
  const acs = getAcsCountyContext(geoid);
  const acsDefinitions = [
    {
      key: "population",
      label: "Population",
      value: acs.population,
      marginOfError: acs.populationMoe,
      unit: "people",
      universe: "Total population",
      direction: "contextual" as const,
      sourceField: "B01001_E001",
    },
    {
      key: "median-age",
      label: "Median age",
      value: acs.medianAge,
      marginOfError: acs.medianAgeMoe,
      unit: "years",
      universe: "Total population",
      direction: "contextual" as const,
      sourceField: "B01002_E001",
    },
    {
      key: "poverty",
      label: "Population below the poverty threshold",
      value: acs.povertyPercent,
      marginOfError: acs.povertyPercentMoe,
      unit: "percent",
      universe: "Population for whom poverty status is determined",
      direction: "adverse" as const,
      sourceField: "B17001_E002 / B17001_E001",
    },
    {
      key: "no-vehicle",
      label: "Households with no vehicle available",
      value: acs.noVehiclePercent,
      marginOfError: acs.noVehiclePercentMoe,
      unit: "percent",
      universe: "Households",
      direction: "adverse" as const,
      sourceField: "B08201_E002 / B08201_E001",
    },
    {
      key: "internet-subscription",
      label: "Households with an internet subscription",
      value: acs.internetSubscriptionPercent,
      marginOfError: acs.internetSubscriptionPercentMoe,
      unit: "percent",
      universe: "Households",
      direction: "protective" as const,
      sourceField: "B28002_E002 / B28002_E001",
    },
  ];
  const availableAcs = acsDefinitions.filter((definition) => definition.value !== null);
  const acsVersionId = deterministicUuid(
    "source-version",
    "census-acs5",
    acsContext.source.releaseDate,
    ...acsContext.sourceArtifacts.map((artifact) => artifact.sha256),
  );
  for (const definition of availableAcs) {
    const observationId = deterministicUuid("county-observation", acsVersionId, geoid, definition.key);
    const citationId = deterministicUuid("county-citation", acsVersionId, geoid, definition.key);
    brief.publicData.observations.push({
      id: observationId,
      measureDefinitionId: deterministicUuid("measure", "census-acs5", definition.key),
      label: definition.label,
      direction: definition.direction,
      unit: definition.unit,
      universe: definition.universe,
      adjustment: "survey_estimate",
      value: definition.value,
      confidence: { low: null, high: null, marginOfError: definition.marginOfError },
      geographyId: brief.resolution.selected?.id
        ?? deterministicUuid("county", geoid, approvedCountyEvidenceSnapshot.censusVintage),
      sourceVersionId: acsVersionId,
      releaseDate: acsContext.source.releaseDate,
      dataPeriod: acsContext.source.dataPeriod,
      reviewStatus: "verified",
      interpretation: definition.direction === "contextual" ? "context_only" : "not_rankable",
      benchmarkObservationId: null,
      citationIds: [citationId],
    });
    brief.citations.push({
      id: citationId,
      sourceVersionId: acsVersionId,
      documentId: null,
      officialUrl: acsContext.source.officialUrl,
      pageNumber: null,
      section: null,
      sourceField: definition.sourceField,
      quotedText: null,
      reviewStatus: "verified",
    });
  }
  const acsCoverage = brief.publicData.sourceCoverage.find((item) => item.sourceId === "census-acs5");
  if (acsCoverage) {
    acsCoverage.status = availableAcs.length === acsDefinitions.length
      ? "available"
      : availableAcs.length ? "partially_available" : "unavailable_from_source";
    acsCoverage.reason = availableAcs.length
      ? `${availableAcs.length} of ${acsDefinitions.length} approved county context measures are available from the official 2020–2024 ACS five-year Summary File. Missing estimates remain missing, and every estimate retains its margin of error where supplied.`
      : "The official ACS Summary File contains no compatible value for the approved county context measures; missing values are not zero.";
    acsCoverage.sourceVersionId = availableAcs.length ? acsVersionId : null;
    acsCoverage.geographyKind = "county";
    acsCoverage.observationCount = availableAcs.length;
    acsCoverage.releaseDate = acsContext.source.releaseDate;
    acsCoverage.dataPeriod = acsContext.source.dataPeriod;
    acsCoverage.retrievedAt = acsContext.generatedAt;
  }
  if (availableAcs.length) {
    brief.publicData.sources.push({
      sourceId: "census-acs5",
      sourceVersionId: acsVersionId,
      publisher: acsContext.source.publisher,
      title: acsContext.source.title,
      officialUrl: acsContext.source.officialUrl,
      releaseDate: acsContext.source.releaseDate,
      dataPeriod: acsContext.source.dataPeriod,
      retrievedAt: acsContext.generatedAt,
      reviewStatus: "verified",
    });
  }
  const hrsa = getHrsaCountyContext(geoid);
  const hrsaCount = hrsa.hpsa.length + hrsa.muaP.length;
  const hrsaVersionId = deterministicUuid(
    "source-version",
    "hrsa-workforce",
    hrsaContext.generatedAt,
    ...hrsaContext.manifests.map((manifest) => manifest.sha256),
  );
  const hrsaCoverage = brief.publicData.sourceCoverage.find((item) => item.sourceId === "hrsa-workforce");
  if (hrsaCoverage) {
    hrsaCoverage.status = hrsaCount ? "available" : "unavailable_from_source";
    hrsaCoverage.reason = hrsaCount
      ? `${hrsaCount} current HRSA designation record${hrsaCount === 1 ? "" : "s"} intersect this county. Designation scope is retained; subcounty, population-group, and facility records are not described as whole-county shortages.`
      : "The approved HRSA source files contain no designation associated with this county. This does not establish that no shortage or access barrier exists.";
    hrsaCoverage.sourceVersionId = hrsaCount ? hrsaVersionId : null;
    hrsaCoverage.geographyKind = hrsaCount ? "source_designation" : "county";
    hrsaCoverage.observationCount = hrsaCount;
    hrsaCoverage.releaseDate = hrsaContext.generatedAt.slice(0, 10);
    hrsaCoverage.dataPeriod = { start: null, end: hrsaContext.generatedAt.slice(0, 10) };
    hrsaCoverage.retrievedAt = hrsaContext.generatedAt;
  }
  if (hrsaCount) {
    brief.publicData.sources.push({
      sourceId: "hrsa-workforce",
      sourceVersionId: hrsaVersionId,
      publisher: "Health Resources and Services Administration",
      title: "Health Workforce Shortage Areas and Medically Underserved Areas/Populations",
      officialUrl: hrsaContext.officialUrl,
      releaseDate: hrsaContext.generatedAt.slice(0, 10),
      dataPeriod: { start: null, end: hrsaContext.generatedAt.slice(0, 10) },
      retrievedAt: hrsaContext.generatedAt,
      reviewStatus: "verified",
    });
  }
  const ahrf = getAhrfCountyContext(geoid);
  const ahrfVersionId = deterministicUuid(
    "source-version",
    "ahrf-workforce",
    ahrfContext.releaseDate,
    ahrfContext.manifests.data.sha256,
    ahrfContext.manifests.documentation.sha256,
  );
  const ahrfCoverage = brief.publicData.sourceCoverage.find((item) => item.sourceId === "ahrf-workforce");
  if (ahrfCoverage) {
    ahrfCoverage.status = ahrf.observations.some((observation) => observation.value !== null)
      ? "available"
      : "unavailable_from_source";
    ahrfCoverage.reason = ahrfCoverage.status === "available"
      ? `${ahrf.observations.filter((observation) => observation.value !== null).length} approved county workforce and facility measures are available. Each retains its source-specific year.`
      : "The approved AHRF source contains no value for the selected workforce and facility variables in this county; missing values are not zero.";
    ahrfCoverage.sourceVersionId = ahrfCoverage.status === "available" ? ahrfVersionId : null;
    ahrfCoverage.observationCount = ahrf.observations.filter((observation) => observation.value !== null).length;
    ahrfCoverage.releaseDate = ahrfContext.releaseDate;
    ahrfCoverage.dataPeriod = {
      start: ahrfContext.dataPeriods.at(0) ?? null,
      end: ahrfContext.dataPeriods.at(-1) ?? null,
    };
    ahrfCoverage.retrievedAt = ahrfContext.generatedAt;
  }
  if (ahrfCoverage?.status === "available") {
    brief.publicData.sources.push({
      sourceId: "ahrf-workforce",
      sourceVersionId: ahrfVersionId,
      publisher: "Health Resources and Services Administration, Bureau of Health Workforce",
      title: ahrfContext.title,
      officialUrl: ahrfContext.officialUrl,
      releaseDate: ahrfContext.releaseDate,
      dataPeriod: {
        start: ahrfContext.dataPeriods.at(0) ?? null,
        end: ahrfContext.dataPeriods.at(-1) ?? null,
      },
      retrievedAt: ahrfContext.generatedAt,
      reviewStatus: "verified",
    });
  }
  const ahrq = getAhrqCountyContext(geoid);
  const availableAhrq = ahrq.observations.filter((observation) => observation.value !== null);
  const ahrqVersionId = deterministicUuid(
    "source-version",
    "ahrq-clh",
    ahrqContext.releaseDate,
    ahrqContext.manifests.data.sha256,
    ahrqContext.manifests.codebook.sha256,
  );
  const ahrqCoverage = brief.publicData.sourceCoverage.find((item) => item.sourceId === "ahrq-clh");
  if (ahrqCoverage) {
    ahrqCoverage.status = availableAhrq.length === ahrq.observations.length
      ? "available"
      : availableAhrq.length ? "partially_available" : "unavailable_from_source";
    ahrqCoverage.reason = availableAhrq.length
      ? `${availableAhrq.length} of ${ahrq.observations.length} codebook-validated county context variables are available from the approved September 2025 Community-Level Health release. Variable-specific source and period notes are retained.`
      : "The approved AHRQ Community-Level Health workbook contains no value for the selected county context variables; missing values are not zero.";
    ahrqCoverage.sourceVersionId = availableAhrq.length ? ahrqVersionId : null;
    ahrqCoverage.geographyKind = "county";
    ahrqCoverage.observationCount = availableAhrq.length;
    ahrqCoverage.releaseDate = ahrqContext.releaseDate;
    ahrqCoverage.dataPeriod = { start: null, end: ahrqContext.fileYear };
    ahrqCoverage.retrievedAt = ahrqContext.generatedAt;
  }
  if (availableAhrq.length) {
    brief.publicData.sources.push({
      sourceId: "ahrq-clh",
      sourceVersionId: ahrqVersionId,
      publisher: ahrqContext.publisher,
      title: ahrqContext.title,
      officialUrl: ahrqContext.officialUrl,
      releaseDate: ahrqContext.releaseDate,
      dataPeriod: { start: null, end: ahrqContext.fileYear },
      retrievedAt: ahrqContext.generatedAt,
      reviewStatus: "verified",
    });
  }
  const planning = localPlanByCounty.get(geoid);
  if (planning?.candidates.length) {
    brief.localPlanningEvidence.documents = planning.candidates.map((candidate) => ({
      id: candidate.id,
      type: candidate.documentType,
      title: candidate.title,
      publisher: candidate.publisher,
      officialUrl: candidate.artifactUrl || candidate.sourcePageUrl,
      publishedAt: candidate.publicationDate,
      period: { start: null, end: null },
      reviewStatus: candidate.reviewStatus,
    }));
    const coverage = brief.publicData.sourceCoverage.find((item) => item.sourceId === "local-planning-documents");
    if (coverage) {
      coverage.status = "awaiting_human_review";
      coverage.reason = `${planning.candidates.length} official-source candidate document${planning.candidates.length === 1 ? "" : "s"} discovered; no local-priority claim is public until named human verification.`;
      coverage.observationCount = planning.candidates.length;
    }
  }
  if (process.env.EVIDENCE_SOURCE_CDC_PLACES_ENABLED === "false") {
    const cdcSourceVersionIds = new Set(
      brief.publicData.sources
        .filter((source) => source.sourceId === "cdc-places")
        .map((source) => source.sourceVersionId),
    );
    const removedObservationIds = new Set(
      brief.publicData.observations
        .filter((observation) => cdcSourceVersionIds.has(observation.sourceVersionId))
        .map((observation) => observation.id),
    );
    brief.publicData.observations = brief.publicData.observations
      .filter((observation) => !removedObservationIds.has(observation.id));
    brief.publicData.sources = brief.publicData.sources
      .filter((source) => source.sourceId !== "cdc-places");
    const retainedCitationIds = new Set(
      brief.publicData.observations.flatMap((observation) => observation.citationIds),
    );
    brief.citations = brief.citations.filter((citation) => retainedCitationIds.has(citation.id));
    const coverage = brief.publicData.sourceCoverage.find((item) => item.sourceId === "cdc-places");
    if (coverage) {
      coverage.status = "ingestion_failed";
      coverage.reason = "CDC PLACES is disabled by the emergency capability switch; the last approved geography snapshot remains active.";
      coverage.sourceVersionId = null;
      coverage.observationCount = 0;
    }
  }
  const selected = brief.resolution.selected;
  brief.evidenceAssessment.known = [
    selected
      ? `The selected geography resolves to ${selected.displayName} (GEOID ${selected.authorityId}).`
      : "No county geography is selected.",
    ...brief.publicData.sourceCoverage
      .filter((coverage) => coverage.status === "available" || coverage.status === "partially_available")
      .map((coverage) => `${coverage.sourceId}: ${coverage.reason}`),
  ];
  brief.evidenceAssessment.missing = brief.publicData.sourceCoverage
    .filter((coverage) => coverage.status !== "available")
    .map((coverage) => `${coverage.sourceId} (${coverage.status.replaceAll("_", " ")}): ${coverage.reason}`);
  return brief;
}
