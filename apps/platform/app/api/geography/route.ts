import { NextRequest, NextResponse } from "next/server";
import { counties, states, sourceManifest } from "../../lib/server-data";
import { checkPublicRateLimit } from "../../lib/public-api-guard";
import { safeSearchTerm } from "../../lib/geography-validation";
import { searchNationalGeographies } from "../../lib/national-geography-search";
import {
  committedCountySource,
  committedIndicatorSnapshot,
  TIGERWEB_CURRENT_SOURCE,
  USGS_GNIS_SOURCE,
} from "../../lib/geography-provenance";
import type { GeographySearchResponse } from "../../lib/types";

export const runtime = "nodejs";

const committedSource = committedCountySource(sourceManifest);
const committedIndicatorSource = committedIndicatorSnapshot(sourceManifest);
const sourceLabel = "Committed Census state/county snapshot + Census TIGERweb + USGS GNIS";
const provenance = {
  committedStateCountySnapshot: committedSource,
  committedIndicatorSnapshot: committedIndicatorSource,
  liveSubcountyLookup: TIGERWEB_CURRENT_SOURCE,
  namedCommunityLookup: USGS_GNIS_SOURCE,
  coverage: {
    statesAndDistrictOfColumbia: states.length,
    countyEquivalents: counties.length,
    subcountyGeographies: "Live authoritative lookup" as const,
    namedCommunities: "Live authoritative lookup" as const,
  },
  limitations: [
    "A Census place or county subdivision may not match a postal city name or local administrative usage.",
    "A ZCTA is a Census statistical area, not a USPS delivery route, and not every ZIP Code has a ZCTA.",
    "Search verifies geography only. Health indicators are loaded separately and are never inferred from a place name or identifier.",
    "A GNIS populated place is a named point, not a Census statistical boundary, postal city, municipal boundary, or service area.",
  ],
};

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
    return NextResponse.json({
      query: term,
      results: [],
      status: "ready",
      source: sourceLabel,
      partial: false,
      remoteUnavailable: false,
      provenance,
    } satisfies GeographySearchResponse);
  }
  const search = await searchNationalGeographies({
    term,
    states,
    counties,
    committedSource,
    committedIndicatorSource,
  });
  const status: GeographySearchResponse["status"] = search.remoteUnavailable
    ? search.results.length ? "committed-only" : "unavailable"
    : search.partial
      ? "partial"
      : "complete";
  const body: GeographySearchResponse = {
    query: term,
    results: search.results,
    status,
    source: sourceLabel,
    provenance,
    partial: search.partial,
    remoteUnavailable: search.remoteUnavailable,
  };
  return NextResponse.json(
    body,
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
