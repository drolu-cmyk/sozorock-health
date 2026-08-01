import { NextRequest, NextResponse } from "next/server";
import { buildPlaceIntelligence } from "../../lib/place-intelligence";
import {
  acsCountySource,
  ahrfCountySource,
  ahrqCountySource,
  getAcsCountyContext,
  getAhrfCountyContext,
  getAhrqCountyContext,
  getHrsaCountyContext,
  nationalCountyBenchmark,
  stateCountyBenchmark,
} from "../../lib/approved-evidence-snapshot";
import {
  getPublishedCountyBrief,
  getPublishedCountyRecord,
} from "../../lib/published-evidence-runtime";
import { exploreMetrics, safeGeoid, scoreMetric, type ExploreKind } from "../../lib/explore-health";
import { enforceEvidenceRateLimit } from "../../lib/evidence-rate-limit";
import { resolveEvidenceCounty } from "../../lib/county-resolution";
import { cdcMeasureDefinitionId, indexCdcObservations } from "../../lib/explore-cdc-metadata";
import {
  evidenceRuntimeEnvironment,
  requireEvidenceGeographyId,
  requirePublishedEvidenceSnapshot,
} from "../../lib/evidence-runtime-authority";
import { placeAgentRuntimeVersions } from "../../lib/place-agent-openai";

export const runtime = "nodejs";

const paths: Record<string, { group: "conditions" | "barriers" | "prevention"; field: string; sourceMeasureId: string }> = {
  bphigh: { group: "conditions", field: "highBloodPressure", sourceMeasureId: "BPHIGH" },
  diabetes: { group: "conditions", field: "diabetes", sourceMeasureId: "DIABETES" },
  obesity: { group: "conditions", field: "obesity", sourceMeasureId: "OBESITY" },
  depression: { group: "conditions", field: "depression", sourceMeasureId: "DEPRESSION" },
  copd: { group: "conditions", field: "copd", sourceMeasureId: "COPD" },
  chd: { group: "conditions", field: "coronaryHeartDisease", sourceMeasureId: "CHD" },
  stroke: { group: "conditions", field: "stroke", sourceMeasureId: "STROKE" },
  cancer: { group: "conditions", field: "cancer", sourceMeasureId: "CANCER" },
  casthma: { group: "conditions", field: "asthma", sourceMeasureId: "CASTHMA" },
  colon_screen: { group: "prevention", field: "colorectalScreening", sourceMeasureId: "COLON_SCREEN" },
  mammouse: { group: "prevention", field: "mammography", sourceMeasureId: "MAMMOUSE" },
  dental: { group: "prevention", field: "dentalVisit", sourceMeasureId: "DENTAL" },
  checkup: { group: "prevention", field: "annualCheckup", sourceMeasureId: "CHECKUP" },
  cholscreen: { group: "prevention", field: "cholesterolScreening", sourceMeasureId: "CHOLSCREEN" },
  access2: { group: "barriers", field: "uninsured", sourceMeasureId: "ACCESS2" },
  lacktrpt: { group: "barriers", field: "transportation", sourceMeasureId: "LACKTRPT" },
  foodinsecu: { group: "barriers", field: "foodInsecurity", sourceMeasureId: "FOODINSECU" },
  housinsecu: { group: "barriers", field: "housingInsecurity", sourceMeasureId: "HOUSINSECU" },
  shututility: { group: "barriers", field: "utilityShutoff", sourceMeasureId: "SHUTUTILITY" },
  disability: { group: "barriers", field: "disability", sourceMeasureId: "DISABILITY" },
  loneliness: { group: "barriers", field: "loneliness", sourceMeasureId: "LONELINESS" },
};

function interpretation(
  higherValueMeaning: "adverse" | "favorable" | "context_dependent",
  difference: number | null,
) {
  if (difference === null) return "comparison_unavailable" as const;
  if (higherValueMeaning === "context_dependent") return "context_only" as const;
  if (Math.abs(difference) < 2) return "equal" as const;
  return higherValueMeaning === "adverse"
    ? difference > 0 ? "adverse_signal" as const : "favorable_signal" as const
    : difference < 0 ? "adverse_signal" as const : "favorable_signal" as const;
}

export async function GET(request: NextRequest) {
  try {
    const rate = await enforceEvidenceRateLimit(request);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: rate.retryAfter ? "Please wait before requesting more evidence." : "Evidence service configuration is incomplete." },
        { status: rate.retryAfter ? 429 : 503, headers: rate.retryAfter ? { "Retry-After": String(rate.retryAfter) } : undefined },
      );
    }
  } catch (error) {
    console.error("evidence-rate-limit-failed", { name: (error as { name?: string }).name ?? "UnknownError" });
    return NextResponse.json({ error: "Evidence service is temporarily unavailable." }, { status: 503 });
  }
  if (process.env.NODE_ENV === "production") {
    try {
      await requirePublishedEvidenceSnapshot(placeAgentRuntimeVersions.snapshotContentHash);
    } catch {
      return NextResponse.json(
        { error: "The approved evidence snapshot is temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  const kindValue = request.nextUrl.searchParams.get("kind");
  const kind = kindValue === "county" || kindValue === "place" || kindValue === "zip"
    ? kindValue as ExploreKind
    : null;
  if (!kind) return NextResponse.json({ error: "Choose a ZIP Code, city or county." }, { status: 400 });
  const geoid = safeGeoid(kind, request.nextUrl.searchParams.get("geoid") ?? "");
  if (!geoid) return NextResponse.json({ error: "Choose a valid U.S. place." }, { status: 400 });
  const originalLabel = (request.nextUrl.searchParams.get("query") ?? geoid).trim().slice(0, 160);
  const requestedCounty = request.nextUrl.searchParams.get("county");
  const resolution = await resolveEvidenceCounty({
    kind,
    geoid,
    label: originalLabel,
    selectedCountyGeoid: requestedCounty,
  });
  if (resolution.status !== "resolved" || !resolution.selectedCountyGeoid) {
    return NextResponse.json({
      error: resolution.status === "selection_required"
        ? "This place intersects more than one county. Choose the county whose evidence you want to view."
        : "No current county or county equivalent could be resolved for this search.",
      resolution,
      sourceCoverageStatus: resolution.status === "selection_required" ? "selection_required" : "incompatible_geography",
    }, { status: resolution.status === "selection_required" ? 409 : 404 });
  }
  const evidenceGeoid = resolution.selectedCountyGeoid;
  if (process.env.NODE_ENV === "production") {
    try {
      await requireEvidenceGeographyId(evidenceGeoid);
    } catch {
      return NextResponse.json(
        { error: "The selected county is not present in the approved evidence store." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  const record = await getPublishedCountyRecord(evidenceGeoid);
  if (!record) return NextResponse.json({ error: "No current Census county or county equivalent matched that GEOID." }, { status: 404 });
  const brief = await getPublishedCountyBrief(evidenceGeoid);
  if (!brief) return NextResponse.json({ error: "The approved evidence snapshot is temporarily unavailable." }, { status: 503 });
  const stateBenchmark = stateCountyBenchmark(record.stateCode);
  const useFixtureOnlyForTests = evidenceRuntimeEnvironment() === "test";
  const acsContext = useFixtureOnlyForTests ? getAcsCountyContext(evidenceGeoid) : {
    population: null, populationMoe: null, medianAge: null, medianAgeMoe: null,
    povertyPercent: null, povertyPercentMoe: null, noVehiclePercent: null,
    noVehiclePercentMoe: null, internetSubscriptionPercent: null, internetSubscriptionPercentMoe: null,
  };
  const workforceContext = useFixtureOnlyForTests ? getHrsaCountyContext(evidenceGeoid) : { hpsa: [], muaP: [] };
  const ahrfContext = useFixtureOnlyForTests ? getAhrfCountyContext(evidenceGeoid) : { observations: [] };
  const ahrqContext = useFixtureOnlyForTests ? getAhrqCountyContext(evidenceGeoid) : { observations: [] };
  const cdcSource = brief.publicData.sources.find((source) => source.sourceId === "cdc-places");
  const cdcObservations = indexCdcObservations(
    brief.publicData.observations,
    cdcSource?.sourceVersionId,
  );

  const metrics = exploreMetrics.flatMap((definition) => {
    const path = paths[definition.key];
    if (!path) return [];
    const metric = record[path.group][path.field];
    const national = nationalCountyBenchmark[path.group][path.field] ?? null;
    const state = stateBenchmark[path.group][path.field] ?? null;
    if (!metric || metric.value === null) return [];
    const difference = national === null ? null : Number((metric.value - national).toFixed(1));
    const observation = cdcObservations.get(cdcMeasureDefinitionId(path.sourceMeasureId));
    const confidence = metric.ci
      ? `${metric.ci[0]}–${metric.ci[1]}`
      : observation?.confidence.low != null && observation.confidence.high != null
        ? `${observation.confidence.low}–${observation.confidence.high}`
        : "";
    return [{
      ...definition,
      value: metric.value,
      confidence,
      national,
      state,
      difference,
      score: national === null ? 0 : scoreMetric(metric.value, national, definition.higherValueMeaning),
      release: observation?.releaseDate ?? cdcSource?.releaseDate ?? "Release unavailable",
      previousValue: null,
      trendDifference: null,
      trend: "unavailable" as const,
      interpretation: interpretation(definition.higherValueMeaning, difference),
      geographyLevel: "county" as const,
      universe: observation?.universe ?? "See the official CDC PLACES measure definition for the eligible population.",
      adjustment: observation?.adjustment ?? "See the official source definition.",
      source: cdcSource?.title ?? "CDC PLACES",
      sourceUrl: cdcSource?.officialUrl ?? "https://www.cdc.gov/places/",
      dataPeriod: observation
        ? `${observation.dataPeriod.start ?? "Unknown"}–${observation.dataPeriod.end ?? "Unknown"}`
        : cdcSource
          ? `${cdcSource.dataPeriod.start}–${cdcSource.dataPeriod.end}`
          : "Data period unavailable",
      retrievedAt: cdcSource?.retrievedAt ?? null,
    }];
  });
  const priorities = metrics
    .filter((metric) => metric.interpretation === "adverse_signal")
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  const location = {
    kind: "county" as const,
    geoid: evidenceGeoid,
    label: `${record.county}, ${record.stateCode}`,
    state: record.stateCode,
    population: record.population ?? acsContext.population ?? 0,
    coordinates: [record.centroid.lon, record.centroid.lat],
    geographyLabel: "Official county or county-equivalent geography",
    geographyAuthority: "U.S. Census Bureau",
    evidenceGeography: "county" as const,
    caveats: brief.resolution.caveats,
    resolution,
  };
  const intelligence = buildPlaceIntelligence({
    location,
    metrics,
    priorities,
    localPlan: null,
  });
  const cdcCoverage = brief.publicData.sourceCoverage.find((item) => item.sourceId === "cdc-places");
  const sourceCoverageById = new Map<string, (typeof brief.publicData.sourceCoverage)[number]>(
    brief.publicData.sourceCoverage.map((coverage) => [coverage.sourceId, coverage]),
  );
  const contextMeasures = [
    {
      key: "acs-population",
      label: "Population",
      value: acsContext.population,
      unit: "people",
      uncertainty: acsContext.populationMoe === null ? null : `±${acsContext.populationMoe.toLocaleString("en-US")}`,
      source: "American Community Survey",
      release: acsCountySource.releaseDate,
      period: `${acsCountySource.dataPeriod.start}–${acsCountySource.dataPeriod.end}`,
      direction: "contextual",
      definition: "Total population",
      sourceUrl: acsCountySource.officialUrl,
    },
    {
      key: "acs-median-age",
      label: "Median age",
      value: acsContext.medianAge,
      unit: "years",
      uncertainty: acsContext.medianAgeMoe === null ? null : `±${acsContext.medianAgeMoe.toFixed(1)}`,
      source: "American Community Survey",
      release: acsCountySource.releaseDate,
      period: `${acsCountySource.dataPeriod.start}–${acsCountySource.dataPeriod.end}`,
      direction: "contextual",
      definition: "Median age of the total population",
      sourceUrl: acsCountySource.officialUrl,
    },
    {
      key: "acs-poverty",
      label: "Population below the poverty threshold",
      value: acsContext.povertyPercent,
      unit: "percent",
      uncertainty: acsContext.povertyPercentMoe === null ? null : `±${acsContext.povertyPercentMoe.toFixed(1)} percentage points`,
      source: "American Community Survey",
      release: acsCountySource.releaseDate,
      period: `${acsCountySource.dataPeriod.start}–${acsCountySource.dataPeriod.end}`,
      direction: "adverse",
      definition: "Population for whom poverty status is determined",
      sourceUrl: acsCountySource.officialUrl,
    },
    {
      key: "acs-no-vehicle",
      label: "Households with no vehicle available",
      value: acsContext.noVehiclePercent,
      unit: "percent",
      uncertainty: acsContext.noVehiclePercentMoe === null ? null : `±${acsContext.noVehiclePercentMoe.toFixed(1)} percentage points`,
      source: "American Community Survey",
      release: acsCountySource.releaseDate,
      period: `${acsCountySource.dataPeriod.start}–${acsCountySource.dataPeriod.end}`,
      direction: "adverse",
      definition: "Households",
      sourceUrl: acsCountySource.officialUrl,
    },
    {
      key: "acs-internet",
      label: "Households with an internet subscription",
      value: acsContext.internetSubscriptionPercent,
      unit: "percent",
      uncertainty: acsContext.internetSubscriptionPercentMoe === null ? null : `±${acsContext.internetSubscriptionPercentMoe.toFixed(1)} percentage points`,
      source: "American Community Survey",
      release: acsCountySource.releaseDate,
      period: `${acsCountySource.dataPeriod.start}–${acsCountySource.dataPeriod.end}`,
      direction: "protective",
      definition: "Households",
      sourceUrl: acsCountySource.officialUrl,
    },
    ...ahrfContext.observations.map((observation) => ({
      key: `ahrf-${observation.variableId}`,
      label: observation.label,
      value: observation.value,
      unit: observation.unit,
      uncertainty: null,
      source: "Area Health Resources Files",
      release: "2025-12-18",
      period: observation.year,
      direction: observation.direction,
      definition: "County context measure; the source does not supply a margin of error.",
      sourceUrl: ahrfCountySource.officialUrl,
    })),
    ...ahrqContext.observations.map((observation) => ({
      key: `ahrq-${observation.variableId}`,
      label: observation.label,
      value: observation.value,
      unit: observation.unit,
      uncertainty: observation.uncertainty,
      source: `AHRQ Community-Level Health (${observation.originalSource})`,
      release: "2025-09-01",
      period: observation.dataPeriod,
      sourceUrl: ahrqCountySource.officialUrl,
      direction: observation.direction,
      definition: `${observation.domain.replace(/^\d+\.\s*/, "")} · ${observation.topic}. The source workbook does not supply a margin of error for this field.`,
    })),
  ];
  return NextResponse.json({
    location,
    summary: priorities[0]
      ? `${priorities[0].label} is one of the strongest comparable signals in the approved county snapshot. It is modeled public data, not a verified local planning priority.`
      : `Compatible modeled county evidence is available for ${location.label}; local priorities still require verified planning evidence and partner review.`,
    metrics,
    priorities,
    dataCoverage: {
      measureCount: metrics.length + contextMeasures.filter((measure) => measure.value !== null).length,
      currentMeasureCount: metrics.length,
      previousMeasureCount: 0,
    },
    contextMeasures,
    offerings: [],
    intelligence,
    localPlan: {
      status: brief.localPlanningEvidence.status,
      documents: brief.localPlanningEvidence.documents.map((document) => ({
        ...document,
        documentType: document.type,
        coverage: "Official-source candidate; geography and current-plan status await named human review.",
        status: "not_yet_verified" as const,
      })),
      claims: brief.localPlanningEvidence.claims,
      note: brief.localPlanningEvidence.documents.length
        ? "An official-source candidate is available for review. It is not presented as this county's verified current plan."
        : "Current local planning evidence: not yet verified.",
    },
    sources: brief.publicData.sources.map((source) => ({
      name: source.title,
      url: source.officialUrl,
      release: source.releaseDate,
      period: [source.dataPeriod.start, source.dataPeriod.end].filter(Boolean).join("–"),
      note: sourceCoverageById.get(source.sourceId)?.reason
        ?? (source.sourceId === "cdc-places" ? cdcCoverage?.reason : "Approved evidence snapshot"),
      status: source.reviewStatus,
      geography: "County",
      retrievedAt: source.retrievedAt,
    })),
    sourceCoverage: brief.publicData.sourceCoverage,
    workforceContext: {
      hpsa: workforceContext.hpsa,
      medicallyUnderservedAreasAndPopulations: workforceContext.muaP,
      areaHealthResources: ahrfContext.observations,
      limitation: "Designation scope is retained. A subcounty, population-group, or facility designation is not presented as a whole-county designation.",
    },
    evidenceContract: {
      contractVersion: brief.contractVersion,
      evidenceSnapshotId: brief.evidenceSnapshotId,
      policyVersion: brief.policyVersion,
      cacheKey: `${brief.contractVersion}:${brief.evidenceSnapshotId}:${brief.policyVersion}:${evidenceGeoid}`,
    },
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "X-Evidence-Snapshot": brief.evidenceSnapshotId,
      "X-Evidence-Contract": brief.contractVersion,
    },
  });
}
