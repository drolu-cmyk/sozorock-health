import { deterministicUuid } from "../ingestion/hash.ts";
import {
  EXPLORE_PLACE_BRIEF_VERSION,
  type ExploreObservation,
  type ExplorePlaceBriefV1,
  type ExploreSourceCoverage,
} from "../explore-contract.ts";

type MetricValue = { value: number | null; ci: [number, number] | null };

export type CountyEvidenceSnapshotRecord = {
  fips: string;
  stateFips: string;
  countyFips: string;
  state: string;
  stateCode: string;
  county: string;
  centroid: { lat: number; lon: number };
  landSquareMiles: number;
  population: number | null;
  adultPopulation: number | null;
  conditions: Record<string, MetricValue>;
  barriers: Record<string, MetricValue>;
  prevention: Record<string, MetricValue>;
  dataCoverage: number;
  sourceStatus: "available" | "unavailable";
};

export type CountyEvidenceSnapshot = {
  schemaVersion: "sozorock.county-evidence-snapshot.v1";
  snapshotId: string;
  generatedAt: string;
  policyVersion: string;
  censusVintage: string;
  cdc: {
    datasetId: string;
    officialUrl: string;
    releaseDate: string;
    dataPeriodStart: string;
    dataPeriodEnd: string;
    retrievedAt: string;
  };
  counties: CountyEvidenceSnapshotRecord[];
};

const definitions = {
  conditions: {
    highBloodPressure: ["BPHIGH", "High blood pressure", "adverse"],
    diabetes: ["DIABETES", "Diabetes", "adverse"],
    coronaryHeartDisease: ["CHD", "Coronary heart disease", "adverse"],
    stroke: ["STROKE", "Stroke", "adverse"],
    cancer: ["CANCER", "Cancer excluding skin cancer", "adverse"],
    asthma: ["CASTHMA", "Current asthma", "adverse"],
    copd: ["COPD", "Chronic obstructive pulmonary disease", "adverse"],
    depression: ["DEPRESSION", "Depression", "adverse"],
    obesity: ["OBESITY", "Obesity", "adverse"],
  },
  barriers: {
    uninsured: ["ACCESS2", "Adults without health insurance", "adverse"],
    transportation: ["LACKTRPT", "Lack of reliable transportation", "adverse"],
    foodInsecurity: ["FOODINSECU", "Food insecurity", "adverse"],
    housingInsecurity: ["HOUSINSECU", "Housing insecurity", "adverse"],
    utilityShutoff: ["SHUTUTILITY", "Utility shutoff or threat", "adverse"],
    loneliness: ["LONELINESS", "Loneliness", "adverse"],
    disability: ["DISABILITY", "Any disability", "contextual"],
  },
  prevention: {
    annualCheckup: ["CHECKUP", "Annual checkup", "protective"],
    dentalVisit: ["DENTAL", "Dental visit", "protective"],
    cholesterolScreening: ["CHOLSCREEN", "Cholesterol screening", "protective"],
    colorectalScreening: ["COLON_SCREEN", "Colorectal cancer screening", "protective"],
    mammography: ["MAMMOUSE", "Mammography use", "protective"],
  },
} as const;

function buildObservations(record: CountyEvidenceSnapshotRecord, snapshot: CountyEvidenceSnapshot) {
  const observations: ExploreObservation[] = [];
  const citations = [];
  for (const [groupName, group] of Object.entries(definitions)) {
    const values = record[groupName as keyof Pick<CountyEvidenceSnapshotRecord, "conditions" | "barriers" | "prevention">];
    for (const [field, [measureId, label, direction]] of Object.entries(group)) {
      const metric = values[field];
      if (!metric || metric.value === null) continue;
      const observationId = deterministicUuid("county-observation", snapshot.snapshotId, record.fips, measureId);
      const citationId = deterministicUuid("county-citation", snapshot.snapshotId, record.fips, measureId);
      observations.push({
        id: observationId,
        measureDefinitionId: deterministicUuid("measure", "cdc-places", `${measureId}:Crude`),
        label,
        direction,
        unit: "percent",
        universe: "See the CDC PLACES measure definition for the eligible population.",
        adjustment: "modeled",
        value: metric.value,
        confidence: {
          low: metric.ci?.[0] ?? null,
          high: metric.ci?.[1] ?? null,
          marginOfError: null,
        },
        geographyId: deterministicUuid("county", record.fips, snapshot.censusVintage),
        sourceVersionId: deterministicUuid("source-version", "cdc-places", snapshot.cdc.datasetId, snapshot.cdc.releaseDate),
        releaseDate: snapshot.cdc.releaseDate,
        dataPeriod: { start: snapshot.cdc.dataPeriodStart, end: snapshot.cdc.dataPeriodEnd },
        reviewStatus: "verified",
        interpretation: direction === "contextual" ? "context_only" : "not_rankable",
        benchmarkObservationId: null,
        citationIds: [citationId],
      });
      citations.push({
        id: citationId,
        sourceVersionId: deterministicUuid("source-version", "cdc-places", snapshot.cdc.datasetId, snapshot.cdc.releaseDate),
        documentId: null,
        officialUrl: snapshot.cdc.officialUrl,
        pageNumber: null,
        section: null,
        sourceField: `${measureId}_CrudePrev`,
        quotedText: null,
        reviewStatus: "verified" as const,
      });
    }
  }
  return { observations, citations };
}

function sourceCoverage(record: CountyEvidenceSnapshotRecord, snapshot: CountyEvidenceSnapshot, observationCount: number): ExploreSourceCoverage[] {
  const cdcStatus = record.sourceStatus === "available"
    ? record.dataCoverage >= 100 ? "available" : "partially_available"
    : "unavailable_from_source";
  return [
    {
      sourceId: "census-geography",
      status: "available",
      reason: `Canonical county geography is loaded from the official Census ${snapshot.censusVintage} vintage.`,
      sourceVersionId: deterministicUuid("source-version", "census-geography", snapshot.censusVintage),
      geographyKind: "county",
      observationCount: 1,
      releaseDate: `${snapshot.censusVintage}-01-01`,
      dataPeriod: { start: `${snapshot.censusVintage}-01-01`, end: `${snapshot.censusVintage}-12-31` },
      retrievedAt: snapshot.generatedAt,
    },
    {
      sourceId: "cdc-places",
      status: cdcStatus,
      reason: cdcStatus === "available"
        ? "The approved CDC PLACES snapshot contains all contracted county measures."
        : cdcStatus === "partially_available"
          ? `CDC PLACES publishes ${record.dataCoverage}% of the contracted county measure set for this geography; absent measures are not treated as zero.`
          : "The approved CDC PLACES release contains no compatible county observations; absent measures are not treated as zero.",
      sourceVersionId: observationCount > 0
        ? deterministicUuid("source-version", "cdc-places", snapshot.cdc.datasetId, snapshot.cdc.releaseDate)
        : null,
      geographyKind: "county",
      observationCount,
      releaseDate: observationCount > 0 ? snapshot.cdc.releaseDate : null,
      dataPeriod: observationCount > 0
        ? { start: snapshot.cdc.dataPeriodStart, end: snapshot.cdc.dataPeriodEnd }
        : { start: null, end: null },
      retrievedAt: observationCount > 0 ? snapshot.cdc.retrievedAt : null,
    },
    {
      sourceId: "census-acs5",
      status: "credential_blocked",
      reason: "The national ACS refresh requires CENSUS_API_KEY in the ingestion runtime. No ACS value is inferred or fabricated.",
      sourceVersionId: null,
      geographyKind: "county",
      observationCount: 0,
      releaseDate: null,
      dataPeriod: { start: null, end: null },
      retrievedAt: null,
    },
    {
      sourceId: "hrsa-workforce",
      status: "not_yet_verified",
      reason: "An approved national HRSA snapshot has not yet completed staging verification for this county.",
      sourceVersionId: null,
      geographyKind: "county",
      observationCount: 0,
      releaseDate: null,
      dataPeriod: { start: null, end: null },
      retrievedAt: null,
    },
    {
      sourceId: "ahrq-clh",
      status: "awaiting_human_review",
      reason: "The AHRQ workbook reader is active, but the approved workbook and codebook import await staging review.",
      sourceVersionId: null,
      geographyKind: "county",
      observationCount: 0,
      releaseDate: null,
      dataPeriod: { start: null, end: null },
      retrievedAt: null,
    },
    {
      sourceId: "local-planning-documents",
      status: "not_yet_verified",
      reason: "Current local planning evidence: not yet verified.",
      sourceVersionId: null,
      geographyKind: "county",
      observationCount: 0,
      releaseDate: null,
      dataPeriod: { start: null, end: null },
      retrievedAt: null,
    },
  ];
}

export function buildCountyPlaceBrief(
  record: CountyEvidenceSnapshotRecord,
  snapshot: CountyEvidenceSnapshot,
  rawQuery = record.fips,
): ExplorePlaceBriefV1 {
  const geographyId = deterministicUuid("county", record.fips, snapshot.censusVintage);
  const { observations, citations } = buildObservations(record, snapshot);
  const coverage = sourceCoverage(record, snapshot, observations.length);
  const missing = coverage
    .filter((item) => !["available", "partially_available"].includes(item.status))
    .map((item) => `${item.sourceId}: ${item.reason}`);
  return {
    contractVersion: EXPLORE_PLACE_BRIEF_VERSION,
    generatedAt: snapshot.generatedAt,
    evidenceSnapshotId: snapshot.snapshotId,
    policyVersion: snapshot.policyVersion,
    query: { raw: rawQuery, kind: "county_fips" },
    resolution: {
      status: "resolved",
      selected: {
        id: geographyId,
        kind: "county",
        authority: "census",
        authorityId: record.fips,
        displayName: `${record.county}, ${record.stateCode}`,
        vintage: snapshot.censusVintage,
        reviewStatus: "verified",
      },
      evidenceGeographies: [{
        id: geographyId,
        kind: "county",
        authority: "census",
        authorityId: record.fips,
        displayName: `${record.county}, ${record.stateCode}`,
        vintage: snapshot.censusVintage,
        reviewStatus: "verified",
      }],
      overlappingCounties: [],
      caveats: [
        "County evidence describes the county as a whole. It must not be presented as specific to every ZIP Code, city, neighborhood, or person inside the county.",
        "CDC PLACES values are modeled area estimates, not patient-level data, diagnoses, or proof of a local planning priority.",
      ],
    },
    localPlanningEvidence: {
      status: "not_yet_verified",
      documents: [],
      claims: [],
    },
    publicData: {
      observations,
      sources: observations.length ? [{
        sourceId: "cdc-places",
        sourceVersionId: deterministicUuid("source-version", "cdc-places", snapshot.cdc.datasetId, snapshot.cdc.releaseDate),
        publisher: "Centers for Disease Control and Prevention",
        title: "PLACES: Local Data for Better Health",
        officialUrl: snapshot.cdc.officialUrl,
        releaseDate: snapshot.cdc.releaseDate,
        dataPeriod: { start: snapshot.cdc.dataPeriodStart, end: snapshot.cdc.dataPeriodEnd },
        retrievedAt: snapshot.cdc.retrievedAt,
        reviewStatus: "verified",
      }] : [],
      sourceCoverage: coverage,
    },
    evidenceAssessment: {
      known: [
        `The selected geography resolves to ${record.county}, ${record.stateCode} (GEOID ${record.fips}).`,
        ...(observations.length ? [`${observations.length} compatible modeled county observations are present in the approved CDC snapshot.`] : []),
      ],
      missing,
      requiresLocalReview: [
        "Current local planning evidence: not yet verified.",
        "Local partners must confirm whether modeled public-data signals correspond to current priorities, assets, barriers, and feasible responses.",
      ],
      responseFits: [{
        response: "no_recommendation_yet",
        status: "insufficient_evidence",
        explanation: "National modeled evidence alone does not establish a local response. Verified local planning evidence and partner review are required.",
        evidenceIds: [],
        missingEvidence: ["Verified current local planning evidence", "Local partner review"],
        requiresHumanReview: true,
      }],
    },
    citations,
    safety: {
      classification: "non_clinical_place_evidence",
      containsPhi: false,
      limitations: [
        "This brief contains population-level public evidence only and does not provide medical advice, diagnosis, triage, or treatment recommendations.",
        "Modeled estimates support exploration and comparison; they do not establish causation or an individual risk profile.",
      ],
    },
  };
}
