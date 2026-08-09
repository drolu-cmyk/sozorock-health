import { NextRequest, NextResponse } from "next/server";
import { validateExplorePlaceBriefV1 } from "@sozorock/evidence-core";
import { getPublishedCountyBrief } from "../../../../lib/published-evidence-runtime";
import { enforceEvidenceRateLimit } from "../../../../lib/evidence-rate-limit";
import {
  requireEvidenceGeographyId,
  requirePublishedEvidenceSnapshot,
  evidenceRuntimeEnvironment,
} from "../../../../lib/evidence-runtime-authority";
import { placeAgentRuntimeVersions } from "../../../../lib/place-agent-openai";
import { normalizePlaceBriefKind } from "../../../../lib/place-brief-query";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Validate the public contract before touching rate-limit or database
  // infrastructure. A malformed query is a client error regardless of
  // whether the evidence authority is currently configured or available.
  const normalizedKind = normalizePlaceBriefKind(request.nextUrl.searchParams);
  const geoid = request.nextUrl.searchParams.get("geoid")?.trim() ?? "";
  if (!normalizedKind.ok || !/^\d{5}$/.test(geoid)) {
    return NextResponse.json({
      error: normalizedKind.ok
        ? "Use kind=county with a valid five-digit Census county GEOID."
        : normalizedKind.message,
      status: normalizedKind.ok ? "incompatible_geography" : normalizedKind.code,
    }, { status: 400 });
  }

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
  if (evidenceRuntimeEnvironment() !== "test") {
    try {
      await requirePublishedEvidenceSnapshot(placeAgentRuntimeVersions.snapshotContentHash);
      await requireEvidenceGeographyId(geoid, placeAgentRuntimeVersions.snapshotContentHash);
    } catch {
      return NextResponse.json(
        { error: "The approved evidence snapshot is temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  const brief = await getPublishedCountyBrief(geoid);
  if (!brief) return NextResponse.json({ error: "County GEOID not found in the approved Census geography snapshot." }, { status: 404 });
  const validation = validateExplorePlaceBriefV1(brief);
  if (!validation.valid) {
    console.error("approved-evidence-contract-invalid", { geoid, errors: validation.errors });
    return NextResponse.json({ error: "The approved evidence response failed contract validation." }, { status: 503 });
  }
  const cacheKey = `${brief.contractVersion}:${brief.evidenceSnapshotId}:${brief.policyVersion}:${geoid}`;
  const headers: Record<string, string> = {
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    ETag: `"${cacheKey}"`,
    "X-Evidence-Cache-Key": cacheKey,
  };
  if (normalizedKind.usedLegacyAlias) headers["X-Deprecated-Query-Parameter"] = "geography; use kind";
  return NextResponse.json(brief, {
    headers,
  });
}
