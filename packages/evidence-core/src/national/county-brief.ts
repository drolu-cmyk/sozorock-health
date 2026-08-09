import { deterministicUuid } from "../ingestion/hash.ts";
import {
  EXPLORE_PLACE_BRIEF_VERSION,
  type ExploreAssessmentReference,
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
      sourceId: "ahrf-workforce",
      status: "not_yet_verified",
      reason: "An approved Area Health Resources Files snapshot has not yet completed staging verification for this county.",
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
        stateFips: record.stateFips,
        stateCode: record.stateCode,
        stateName: record.state,
        vintage: snapshot.censusVintage,
        reviewStatus: "verified",
      },
      evidenceGeographies: [{
        id: geographyId,
        kind: "county",
        authority: "census",
        authorityId: record.fips,
        displayName: `${record.county}, ${record.stateCode}`,
        stateFips: record.stateFips,
        stateCode: record.stateCode,
        stateName: record.state,
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

/**
 * Rebuild the assessment only after observations, sources and coverage have
 * been applied. This is the single assessment policy used by API responses,
 * agent context and exports; it never relies on fixture-era missingness.
 */
export function recomputeEvidenceAssessment(
  brief: ExplorePlaceBriefV1,
  workforceRecords: Array<{
    wholeCounty: boolean;
    designationId?: string;
    designationName?: string;
    designationType?: string;
    sourceId?: string;
    sourceVersionId?: string;
    releaseDate?: string | null;
    dataPeriod?: { start: string | null; end: string | null };
    officialUrl?: string;
  }> = [],
): ExplorePlaceBriefV1["evidenceAssessment"] {
  const selected = brief.resolution.selected;
  const available = brief.publicData.sourceCoverage.filter((coverage) =>
    coverage.status === "available" || coverage.status === "partially_available",
  );
  const missing = brief.publicData.sourceCoverage
    .filter((coverage) => !["available", "partially_available"].includes(coverage.status))
    .map((coverage) => `${coverage.sourceId} (${coverage.status.replaceAll("_", " ")}): ${coverage.reason}`);
  const adverseSignals = brief.publicData.observations.filter((observation) =>
    observation.direction === "adverse" && observation.value !== null,
  );
  const localPlanVerified = brief.localPlanningEvidence.status === "verified"
    && brief.localPlanningEvidence.documents.some((document) => document.reviewStatus === "verified");
  const evidenceIds = adverseSignals.map((observation) => observation.id);
  const hrsaCoverage = brief.publicData.sourceCoverage.find((coverage) => coverage.sourceId === "hrsa-workforce");
  const ahrfCoverage = brief.publicData.sourceCoverage.find((coverage) => coverage.sourceId === "ahrf-workforce");
  const hrsaAvailable = Boolean(hrsaCoverage && ["available", "partially_available"].includes(hrsaCoverage.status));
  const compatibleWorkforceRecords = hrsaAvailable ? workforceRecords : [];
  const hrsaRecordCount = compatibleWorkforceRecords.length;
  const hrsaWholeCountyRecordCount = compatibleWorkforceRecords.filter((record) => record.wholeCounty).length;
  const hrsaScopedRecordCount = Math.max(0, hrsaRecordCount - hrsaWholeCountyRecordCount);
  const ahrfSourceVersionIds = new Set(
    brief.publicData.sources
      .filter((source) => source.sourceId === "ahrf-workforce")
      .map((source) => source.sourceVersionId),
  );
  const ahrfAvailable = Boolean(ahrfCoverage && ["available", "partially_available"].includes(ahrfCoverage.status));
  const ahrfObservations = ahrfAvailable
    ? brief.publicData.observations.filter((observation) => ahrfSourceVersionIds.has(observation.sourceVersionId))
    : [];
  const ahrfRecordCount = ahrfObservations.length;
  const workforceEvidenceAvailable = hrsaRecordCount > 0 || ahrfRecordCount > 0;
  const hrsaScope = hrsaWholeCountyRecordCount > 0
    ? "whole_county_available" as const
    : hrsaRecordCount > 0
      ? "scoped_records_available" as const
      : hrsaAvailable
        ? "source_available_no_county_records" as const
        : "source_unavailable" as const;
  const workforceInterpretation = hrsaScope === "whole_county_available"
    ? `HRSA includes ${hrsaWholeCountyRecordCount} whole-county designation record${hrsaWholeCountyRecordCount === 1 ? "" : "s"}; local interpretation is still required.`
    : hrsaScope === "scoped_records_available"
      ? `HRSA includes ${hrsaRecordCount} county-associated designation record${hrsaRecordCount === 1 ? "" : "s"}, but they are subcounty, population-group, facility, or other source-defined records rather than whole-county findings.`
      : hrsaScope === "source_available_no_county_records"
        ? "The HRSA source is available, but no county-associated designation record is present in this snapshot. This does not mean no shortage exists."
        : "The approved HRSA source is unavailable for this county in the selected snapshot.";
  const sourceById = new Map(brief.publicData.sources.map((source) => [source.sourceId, source]));
  const geographyName = selected?.displayName ?? "the selected county";
  const references: ExploreAssessmentReference[] = brief.publicData.sourceCoverage.map((coverage) => {
    const source = sourceById.get(coverage.sourceId);
    const claim = `${coverage.sourceId}: ${coverage.status.replaceAll("_", " ")}. ${coverage.reason}`;
    return {
      id: `coverage:${brief.evidenceSnapshotId}:${selected?.authorityId ?? "unknown"}:${coverage.sourceId}`,
      evidenceType: "source_coverage" as const,
      claim,
      sourceId: coverage.sourceId,
      sourceVersionId: coverage.sourceVersionId,
      publisher: source?.publisher ?? "SozoRock Evidence Core",
      sourceTitle: source?.title ?? `${coverage.sourceId} coverage record`,
      officialUrl: source?.officialUrl ?? null,
      releaseDate: coverage.releaseDate,
      dataPeriod: coverage.dataPeriod,
      geography: geographyName,
      status: coverage.status,
    };
  });
  references.push({
    id: `planning-status:${brief.evidenceSnapshotId}:${selected?.authorityId ?? "unknown"}`,
    evidenceType: "planning_status",
    claim: brief.localPlanningEvidence.status === "verified"
      ? "Current local planning evidence is verified."
      : "Current local planning evidence: not yet verified.",
    sourceId: "local-planning-documents",
    sourceVersionId: null,
    publisher: "SozoRock Evidence Core",
    sourceTitle: "Local planning evidence review status",
    officialUrl: null,
    releaseDate: null,
    dataPeriod: { start: null, end: null },
    geography: geographyName,
    status: brief.localPlanningEvidence.status,
  });
  compatibleWorkforceRecords.forEach((record, index) => {
    const sourceId = record.sourceId ?? "hrsa-workforce";
    const source = sourceById.get(sourceId);
    const designationId = record.designationId ?? `record-${index + 1}`;
    references.push({
      id: `workforce:${brief.evidenceSnapshotId}:${selected?.authorityId ?? "unknown"}:${sourceId}:${designationId}`,
      evidenceType: "workforce_designation",
      claim: `${record.designationName ?? "HRSA workforce designation"} (${record.designationType ?? (record.wholeCounty ? "whole-county" : "source-defined scoped designation")}); ${record.wholeCounty ? "whole-county scope" : "subcounty, population-group, facility, or other source-defined scope"}.`,
      sourceId,
      sourceVersionId: record.sourceVersionId ?? source?.sourceVersionId ?? null,
      publisher: source?.publisher ?? "Health Resources and Services Administration",
      sourceTitle: source?.title ?? "Health workforce designation record",
      officialUrl: record.officialUrl ?? source?.officialUrl ?? null,
      releaseDate: record.releaseDate ?? source?.releaseDate ?? null,
      dataPeriod: record.dataPeriod ?? source?.dataPeriod ?? { start: null, end: null },
      geography: geographyName,
      status: "verified",
    });
  });
  ahrfObservations.forEach((observation) => {
    const source = brief.publicData.sources.find((candidate) => candidate.sourceVersionId === observation.sourceVersionId);
    references.push({
      id: `workforce-observation:${brief.evidenceSnapshotId}:${observation.id}`,
      evidenceType: "metric_observation",
      claim: `${observation.label}: ${observation.value === null ? "unavailable" : `${observation.value} ${observation.unit}`} for ${observation.universe}.`,
      sourceId: "ahrf-workforce",
      sourceVersionId: observation.sourceVersionId,
      publisher: source?.publisher ?? "Health Resources and Services Administration, Bureau of Health Workforce",
      sourceTitle: source?.title ?? "Area Health Resources Files",
      officialUrl: source?.officialUrl ?? null,
      releaseDate: observation.releaseDate,
      dataPeriod: observation.dataPeriod,
      geography: geographyName,
      status: observation.reviewStatus === "verified" ? "verified" : "not_yet_verified",
    });
  });
  const known = [
    selected
      ? `The selected geography resolves to ${selected.displayName} (GEOID ${selected.authorityId}).`
      : "No county geography is selected.",
    ...available.map((coverage) => `${coverage.sourceId}: ${coverage.reason}`),
  ];
  const responseFits: ExplorePlaceBriefV1["evidenceAssessment"]["responseFits"] = [
    {
      response: "health_access_day",
      status: localPlanVerified && evidenceIds.length ? "fit_for_local_review" : "insufficient_evidence",
      explanation: localPlanVerified && evidenceIds.length
        ? "Verified local planning evidence and compatible population measures support local review of a Health Access Day."
        : "Population measures alone do not establish a local Health Access Day priority; verified local planning evidence and partner review are required.",
      evidenceIds: localPlanVerified ? evidenceIds : [],
      missingEvidence: localPlanVerified ? [] : ["Verified local planning evidence", "Local partner review"],
      requiresHumanReview: true,
    },
    {
      response: "health_equity_hub",
      status: evidenceIds.length && localPlanVerified ? "fit_for_local_review" : "insufficient_evidence",
      explanation: evidenceIds.length && localPlanVerified
        ? "The evidence can support review of a Health Equity Hub format without selecting a delivery site or replacing local planning."
        : "A hub format requires compatible place evidence plus local asset and partner review.",
      evidenceIds: evidenceIds.length && localPlanVerified ? evidenceIds : [],
      missingEvidence: evidenceIds.length && localPlanVerified ? [] : ["Verified local planning evidence", "Verified local assets and partners"],
      requiresHumanReview: true,
    },
    {
      response: "provider_led_pathway",
      status: "insufficient_evidence",
      explanation: "Provider-led pathway design requires verified local provider capacity and partner review; the evidence brief does not make a clinical decision.",
      evidenceIds: [],
      missingEvidence: ["Verified provider capacity", "Local partner review"],
      requiresHumanReview: true,
    },
    {
      response: "workforce_conversation",
      status: workforceEvidenceAvailable ? "fit_for_local_review" : "insufficient_evidence",
      explanation: workforceEvidenceAvailable
        ? `${workforceInterpretation} Compatible workforce evidence can support a workforce conversation for local review, but it does not establish a final response.`
        : "A workforce conversation requires a source-compatible designation or workforce measure and local review.",
      evidenceIds: workforceEvidenceAvailable
        ? references
            .filter((reference) => reference.evidenceType === "workforce_designation" || reference.evidenceType === "metric_observation")
            .map((reference) => reference.id)
        : [],
      missingEvidence: workforceEvidenceAvailable
        ? [
            ...(hrsaScope === "scoped_records_available" ? ["Whole-county workforce scope, if required for the planning question"] : []),
            "Local interpretation and partner review",
          ]
        : ["Compatible workforce evidence", "Local partner review"],
      requiresHumanReview: true,
    },
    {
      response: "no_recommendation_yet",
      status: evidenceIds.length && !localPlanVerified ? "fit_for_local_review" : "insufficient_evidence",
      explanation: evidenceIds.length && !localPlanVerified
        ? "Signals are visible, but no response should be selected until current local planning evidence and partners are verified."
        : "The current evidence set does not support a place-specific response recommendation.",
      evidenceIds: evidenceIds.length && !localPlanVerified ? evidenceIds : [],
      missingEvidence: evidenceIds.length && !localPlanVerified ? ["Verified local planning evidence", "Local partner review"] : ["Compatible evidence"],
      requiresHumanReview: true,
    },
  ];
  return {
    known,
    missing,
    requiresLocalReview: [
      ...(localPlanVerified ? [] : ["Current local planning evidence: not yet verified."]),
      "Local partners must confirm whether population-level signals correspond to current priorities, assets, barriers and feasible responses.",
    ],
    responseFits,
    references,
    workforce: {
      hrsa: {
        sourceStatus: hrsaCoverage?.status ?? "unavailable_from_source",
        recordCount: hrsaRecordCount,
        wholeCountyRecordCount: hrsaWholeCountyRecordCount,
        scopedRecordCount: hrsaScopedRecordCount,
        scope: hrsaScope,
      },
      ahrf: {
        sourceStatus: ahrfCoverage?.status ?? "unavailable_from_source",
        recordCount: ahrfRecordCount,
      },
      interpretation: ahrfAvailable && ahrfRecordCount > 0
        ? `${workforceInterpretation} AHRF also includes ${ahrfRecordCount} compatible county workforce or facility context record${ahrfRecordCount === 1 ? "" : "s"}.`
        : workforceInterpretation,
      requiresLocalReview: true,
    },
  };
}
