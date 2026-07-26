import { NextRequest, NextResponse } from "next/server";
import { validateExplorePlaceBriefV1 } from "@sozorock/evidence-core";
import { getApprovedCountyBrief } from "../../../../lib/approved-evidence-snapshot";
import { enforceEvidenceRateLimit } from "../../../../lib/evidence-rate-limit";

export const runtime = "nodejs";

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
  const geography = request.nextUrl.searchParams.get("geography");
  const geoid = request.nextUrl.searchParams.get("geoid")?.trim() ?? "";
  if (geography !== "county" || !/^\d{5}$/.test(geoid)) {
    return NextResponse.json({
      error: "Use geography=county with a valid five-digit Census county GEOID.",
      status: "incompatible_geography",
    }, { status: 400 });
  }
  const brief = getApprovedCountyBrief(geoid);
  if (!brief) return NextResponse.json({ error: "County GEOID not found in the approved Census geography snapshot." }, { status: 404 });
  const validation = validateExplorePlaceBriefV1(brief);
  if (!validation.valid) {
    console.error("approved-evidence-contract-invalid", { geoid, errors: validation.errors });
    return NextResponse.json({ error: "The approved evidence response failed contract validation." }, { status: 503 });
  }
  const cacheKey = `${brief.contractVersion}:${brief.evidenceSnapshotId}:${brief.policyVersion}:${geoid}`;
  return NextResponse.json(brief, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      ETag: `"${cacheKey}"`,
      "X-Evidence-Cache-Key": cacheKey,
    },
  });
}
