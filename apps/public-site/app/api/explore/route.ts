import { NextRequest, NextResponse } from "next/server";
import { buildPlaceIntelligence } from "../../lib/place-intelligence";
import {
  countyRecordByFips,
  getApprovedCountyBrief,
  nationalCountyBenchmark,
  stateCountyBenchmark,
} from "../../lib/approved-evidence-snapshot";
import { exploreMetrics, safeGeoid, scoreMetric, type ExploreKind } from "../../lib/explore-health";
import { enforceEvidenceRateLimit } from "../../lib/evidence-rate-limit";

export const runtime = "nodejs";

const paths: Record<string, { group: "conditions" | "barriers" | "prevention"; field: string }> = {
  bphigh: { group: "conditions", field: "highBloodPressure" },
  diabetes: { group: "conditions", field: "diabetes" },
  obesity: { group: "conditions", field: "obesity" },
  depression: { group: "conditions", field: "depression" },
  copd: { group: "conditions", field: "copd" },
  colon_screen: { group: "prevention", field: "colorectalScreening" },
  mammouse: { group: "prevention", field: "mammography" },
  dental: { group: "prevention", field: "dentalVisit" },
  access2: { group: "barriers", field: "uninsured" },
  lacktrpt: { group: "barriers", field: "transportation" },
  foodinsecu: { group: "barriers", field: "foodInsecurity" },
  disability: { group: "barriers", field: "disability" },
  loneliness: { group: "barriers", field: "loneliness" },
};

function interpretation(
  higherValueMeaning: "adverse" | "favorable" | "context_dependent",
  difference: number,
) {
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
  const kindValue = request.nextUrl.searchParams.get("kind");
  const kind = kindValue === "county" || kindValue === "place" || kindValue === "zip"
    ? kindValue as ExploreKind
    : null;
  if (!kind) return NextResponse.json({ error: "Choose a ZIP Code, city or county." }, { status: 400 });
  const geoid = safeGeoid(kind, request.nextUrl.searchParams.get("geoid") ?? "");
  if (!geoid) return NextResponse.json({ error: "Choose a valid U.S. place." }, { status: 400 });
  if (kind !== "county") {
    return NextResponse.json({
      error: "This release validates county evidence only. ZIP Codes, ZCTAs and Census places remain distinct and are not being converted to county evidence.",
      sourceCoverageStatus: "incompatible_geography",
    }, { status: 409 });
  }
  const record = countyRecordByFips.get(geoid);
  if (!record) return NextResponse.json({ error: "No current Census county or county equivalent matched that GEOID." }, { status: 404 });
  const brief = getApprovedCountyBrief(geoid);
  if (!brief) return NextResponse.json({ error: "The approved evidence snapshot is temporarily unavailable." }, { status: 503 });
  const stateBenchmark = stateCountyBenchmark(record.stateCode);

  const metrics = exploreMetrics.flatMap((definition) => {
    const path = paths[definition.key];
    if (!path) return [];
    const metric = record[path.group][path.field];
    const national = nationalCountyBenchmark[path.group][path.field] ?? null;
    const state = stateBenchmark[path.group][path.field] ?? null;
    if (!metric || metric.value === null || national === null) return [];
    const difference = Number((metric.value - national).toFixed(1));
    return [{
      ...definition,
      value: metric.value,
      confidence: metric.ci ? `${metric.ci[0]}–${metric.ci[1]}` : "",
      national,
      state,
      difference,
      score: scoreMetric(metric.value, national, definition.higherValueMeaning),
      release: "2025" as const,
      previousValue: null,
      trendDifference: null,
      trend: "unavailable" as const,
      interpretation: interpretation(definition.higherValueMeaning, difference),
      geographyLevel: "county" as const,
    }];
  });
  const priorities = metrics
    .filter((metric) => metric.interpretation === "adverse_signal")
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  const location = {
    kind: "county" as const,
    geoid,
    label: `${record.county}, ${record.stateCode}`,
    state: record.stateCode,
    population: record.population ?? 0,
    coordinates: [record.centroid.lon, record.centroid.lat],
    geographyLabel: "Official county or county-equivalent geography",
    geographyAuthority: "U.S. Census Bureau",
    evidenceGeography: "county" as const,
    caveats: brief.resolution.caveats,
  };
  const intelligence = buildPlaceIntelligence({
    location,
    metrics,
    priorities,
    localPlan: null,
  });
  const cdcCoverage = brief.publicData.sourceCoverage.find((item) => item.sourceId === "cdc-places");
  return NextResponse.json({
    location,
    summary: priorities[0]
      ? `${priorities[0].label} is one of the strongest comparable signals in the approved county snapshot. It is modeled public data, not a verified local planning priority.`
      : `Compatible modeled county evidence is available for ${location.label}; local priorities still require verified planning evidence and partner review.`,
    metrics,
    priorities,
    dataCoverage: {
      measureCount: metrics.length,
      currentMeasureCount: metrics.length,
      previousMeasureCount: 0,
    },
    offerings: [],
    intelligence,
    localPlan: {
      status: brief.localPlanningEvidence.status,
      documents: brief.localPlanningEvidence.documents,
      claims: brief.localPlanningEvidence.claims,
      note: "Current local planning evidence: not yet verified.",
    },
    sources: brief.publicData.sources.map((source) => ({
      name: source.title,
      url: source.officialUrl,
      release: source.releaseDate,
      period: [source.dataPeriod.start, source.dataPeriod.end].filter(Boolean).join("–"),
      note: cdcCoverage?.reason ?? "Approved evidence snapshot",
      status: source.reviewStatus,
      geography: "County",
      retrievedAt: source.retrievedAt,
    })),
    sourceCoverage: brief.publicData.sourceCoverage,
    evidenceContract: {
      contractVersion: brief.contractVersion,
      evidenceSnapshotId: brief.evidenceSnapshotId,
      policyVersion: brief.policyVersion,
      cacheKey: `${brief.contractVersion}:${brief.evidenceSnapshotId}:${brief.policyVersion}:${geoid}`,
    },
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "X-Evidence-Snapshot": brief.evidenceSnapshotId,
      "X-Evidence-Contract": brief.contractVersion,
    },
  });
}
