import { NextRequest, NextResponse } from "next/server";
import { enforceEvidenceRateLimit } from "../../../../lib/evidence-rate-limit";
import {
  requireEvidenceGeographyId,
  requirePublishedEvidenceSnapshot,
} from "../../../../lib/evidence-runtime-authority";
import { getPublishedEvidenceGateway } from "../../../../lib/published-evidence-gateway";
import { placeAgentRuntimeVersions } from "../../../../lib/place-agent-openai";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const geoid = request.nextUrl.searchParams.get("geoid")?.trim() ?? "";
  if (!/^\d{5}$/.test(geoid)) {
    return NextResponse.json(
      {
        error: "Use a valid five-digit Census county GEOID.",
        status: "incompatible_geography",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const rate = await enforceEvidenceRateLimit(request);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: rate.retryAfter
            ? "Please wait before requesting more evidence."
            : "Evidence service configuration is incomplete.",
        },
        {
          status: rate.retryAfter ? 429 : 503,
          headers: {
            "Cache-Control": "no-store",
            ...(rate.retryAfter ? { "Retry-After": String(rate.retryAfter) } : {}),
          },
        },
      );
    }
  } catch (error) {
    console.error("evidence-gateway-rate-limit-failed", {
      name: (error as { name?: string }).name ?? "UnknownError",
    });
    return NextResponse.json(
      { error: "Evidence service is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    if (process.env.NODE_ENV === "production") {
      await requirePublishedEvidenceSnapshot(placeAgentRuntimeVersions.snapshotContentHash);
      await requireEvidenceGeographyId(
        geoid,
        placeAgentRuntimeVersions.snapshotContentHash,
      );
    }

    const response = await getPublishedEvidenceGateway(
      geoid,
      placeAgentRuntimeVersions.snapshotContentHash,
    );
    if (!response) {
      return NextResponse.json(
        { error: "County evidence is not available in the approved published snapshot." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const etag = `"${response.manifest.release_hash}"`;
    const headers: Record<string, string> = {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      ETag: etag,
      "X-Evidence-Contract": response.manifest.contract_version,
      "X-Evidence-Release": response.manifest.release_id,
      "X-Evidence-Release-Hash": response.manifest.release_hash,
    };

    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers });
    }

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error("published-evidence-gateway-failed", {
      geoid,
      name: (error as { name?: string }).name ?? "UnknownError",
    });
    return NextResponse.json(
      { error: "The approved evidence snapshot is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
