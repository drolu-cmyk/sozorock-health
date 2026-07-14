import { NextRequest, NextResponse } from "next/server";
import {
  cdcProfileFieldsByKind,
  countiesByFips,
  countyToProfile,
  emptyProfile,
  nationalBenchmark,
  profileForState,
  profileFromCdcRow,
  sourceManifest,
  stateBenchmarks,
  states,
} from "../../lib/server-data";
import type { GeographyKind, ProfileResponse } from "../../lib/types";
import { checkPublicRateLimit } from "../../lib/public-api-guard";
import { validGeoidForKind } from "../../lib/geography-validation";
import { cdcProfileSources } from "../../lib/cdc-profile-contract";
import { lookupCensusGeography, type CensusGeographyLookup } from "../../lib/census-geography";
import { buildProfileProvenance } from "../../lib/profile-provenance";

export const runtime = "nodejs";

function safeGeoid(value: string) {
  return /^\d{2,10}$/.test(value) ? value : "";
}

async function cdcProfile(kind: "place" | "zcta", geoid: string) {
  const dataset = cdcProfileSources[kind].id;
  const field = kind === "place" ? "placefips" : "zcta5";
  const params = new URLSearchParams({
    $limit: "1",
    $select: cdcProfileFieldsByKind[kind].join(","),
    $where: `${field}='${geoid}'`,
  });
  const response = await fetch(`https://data.cdc.gov/resource/${dataset}.json?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SozoRock-CB-CAP-Profile/1.0",
    },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) {
    throw new Error(`CDC PLACES ${kind} profile request failed with status ${response.status}`);
  }
  const rows = await response.json() as Record<string, unknown>[];
  return rows[0] ?? null;
}

export async function GET(request: NextRequest) {
  const rate = checkPublicRateLimit(request.headers, "geography-profile", 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Profile requests are arriving too quickly. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter), "Cache-Control": "no-store" } },
    );
  }
  const kind = request.nextUrl.searchParams.get("kind") as GeographyKind | null;
  const geoid = safeGeoid(request.nextUrl.searchParams.get("geoid") ?? "");
  if (!kind || !["state", "county", "place", "locality", "zcta"].includes(kind) || !geoid || !validGeoidForKind(kind, geoid)) {
    return NextResponse.json({ error: "A valid geography is required." }, { status: 400 });
  }
  if ((kind === "place" || kind === "locality") && !stateBenchmarks.has(geoid.slice(0, 2))) {
    return NextResponse.json({ error: "Geography not found." }, { status: 404 });
  }

  let verifiedCensus: CensusGeographyLookup | null = null;
  if (kind === "place" || kind === "locality" || kind === "zcta") {
    verifiedCensus = await lookupCensusGeography(kind, geoid);
    if (verifiedCensus.status === "unavailable") {
      return NextResponse.json(
        { error: "This public-data profile is temporarily unavailable. Please try again." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (verifiedCensus.status === "not-found" || !verifiedCensus.name) {
      return NextResponse.json({ error: "Geography not found." }, { status: 404 });
    }
  }

  let profile;
  let censusOnlySource: { label: string; url: string } | null = null;
  if (kind === "county") {
    const county = countiesByFips.get(geoid.padStart(5, "0"));
    if (!county) return NextResponse.json({ error: "County not found." }, { status: 404 });
    profile = countyToProfile(county);
  } else if (kind === "state") {
    profile = profileForState(geoid.padStart(2, "0"));
    if (!profile) return NextResponse.json({ error: "State not found." }, { status: 404 });
  } else if (kind === "locality") {
    const census = verifiedCensus;
    if (!census || census.status !== "found") {
      return NextResponse.json({ error: "Geography not found." }, { status: 404 });
    }
    const state = states.find((candidate) => candidate.fips === census.stateFips);
    if (!state) return NextResponse.json({ error: "Geography not found." }, { status: 404 });
    const stateFips = census.stateFips;
    profile = emptyProfile(
      kind,
      geoid,
      census.name,
      `${state.name} · ${census.contextLabel} GEOID ${geoid}. Compatible PLACES estimates are not available at this geography.`,
      stateFips,
    );
    censusOnlySource = {
      label: `U.S. Census Bureau TIGERweb: ${census.contextLabel}`,
      url: census.sourceUrl,
    };
  } else {
    let row;
    try {
      row = await cdcProfile(kind, geoid);
    } catch {
      return NextResponse.json(
        { error: "This public-data profile is temporarily unavailable. Please try again." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const stateFips = kind === "place" && stateBenchmarks.has(geoid.slice(0, 2))
      ? geoid.slice(0, 2)
      : "";
    if (row) {
      profile = profileFromCdcRow(
        kind,
        geoid,
        verifiedCensus?.status === "found" ? verifiedCensus.name : `Census place ${geoid}`,
        row,
        stateFips,
      );
    } else {
      const census = verifiedCensus;
      if (!census || census.status !== "found") {
        return NextResponse.json({ error: "Geography not found." }, { status: 404 });
      }
      const resolvedStateFips = kind === "place" ? census.stateFips : "";
      const state = kind === "place"
        ? states.find((candidate) => candidate.fips === resolvedStateFips)
        : null;
      if (kind === "place" && !state) {
        return NextResponse.json({ error: "Geography not found." }, { status: 404 });
      }
      profile = emptyProfile(
        kind,
        geoid,
        census.name,
        kind === "zcta"
          ? "Census ZIP Code Tabulation Area (ZCTA); not a USPS delivery route"
          : `${state?.name ?? "United States"} · ${census.contextLabel} GEOID ${geoid}`,
        resolvedStateFips,
      );
      censusOnlySource = {
        label: `U.S. Census Bureau TIGERweb: ${census.contextLabel}`,
        url: census.sourceUrl,
      };
    }
  }

  const response: ProfileResponse = {
    profile,
    stateBenchmark: profile.stateFips ? stateBenchmarks.get(profile.stateFips) ?? null : null,
    nationalBenchmark,
    source: censusOnlySource
      ? {
          ...censusOnlySource,
          released: "Current TIGERweb service",
          modeledEstimateNotice: "This geography is verified by the Census Bureau, but no compatible CDC PLACES profile is available in this demonstration.",
        }
      : kind === "place" || kind === "zcta"
      ? {
          label: cdcProfileSources[kind].label,
          url: cdcProfileSources[kind].url,
          released: cdcProfileSources[kind].released,
          modeledEstimateNotice: "CDC PLACES values are model-based population estimates, not diagnoses or counts of individual people.",
        }
      : kind === "locality"
        ? {
            label: "U.S. Census Bureau TIGERweb geography",
            url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer",
            released: "Current TIGERweb service",
            modeledEstimateNotice: "This searchable geography has no compatible CDC PLACES profile in this demonstration.",
          }
        : {
            label: sourceManifest.indicators.source,
            url: sourceManifest.indicators.url,
            released: sourceManifest.indicators.released,
            modeledEstimateNotice: sourceManifest.indicators.modeledEstimateNotice,
          },
    provenance: buildProfileProvenance({
      kind,
      profile,
      manifest: sourceManifest,
      censusSourceUrl: verifiedCensus?.status === "found" ? verifiedCensus.sourceUrl : null,
    }),
  };
  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
