import { NextRequest, NextResponse } from "next/server";
import { counties, states } from "../../lib/server-data";
import { checkPublicRateLimit } from "../../lib/public-api-guard";
import { safeSearchTerm } from "../../lib/geography-validation";
import { searchNationalGeographies } from "../../lib/national-geography-search";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rate = checkPublicRateLimit(request.headers, "geography-search", 40);
  if (!rate.allowed) {
    return NextResponse.json(
      { results: [], error: "Search is receiving too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter), "Cache-Control": "no-store" } },
    );
  }
  const term = safeSearchTerm(request.nextUrl.searchParams.get("q") ?? "");
  if (term.length < 2) {
    return NextResponse.json({ results: [], source: "Committed Census county snapshot + U.S. Census Bureau TIGERweb" });
  }
  const search = await searchNationalGeographies({ term, states, counties });
  return NextResponse.json(
    {
      results: search.results,
      source: "Committed Census county snapshot + U.S. Census Bureau TIGERweb",
      partial: search.partial,
      remoteUnavailable: search.remoteUnavailable,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": search.partial
          ? "no-store"
          : "public, s-maxage=604800, stale-while-revalidate=2592000",
      },
    },
  );
}
