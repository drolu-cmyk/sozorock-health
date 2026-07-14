import { NextRequest, NextResponse } from "next/server";
import { countiesByFips } from "../../lib/server-data";
import { checkPublicRateLimit } from "../../lib/public-api-guard";

export const runtime = "nodejs";

const releases = [
  { year: 2022, dataset: "xyst-f73f" },
  { year: 2023, dataset: "7cmc-7y5g" },
  { year: 2024, dataset: "d3i6-k6z5" },
  { year: 2025, dataset: "i46a-9kgh" },
] as const;

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

async function releaseProfile(dataset: string, fips: string) {
  const params = new URLSearchParams({
    $limit: "1",
    $select: "countyfips,totalpopulation,diabetes_crudeprev,bphigh_crudeprev,access2_crudeprev",
    $where: `countyfips='${fips}'`,
  });
  const response = await fetch(`https://data.cdc.gov/resource/${dataset}.json?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SozoRock-CB-CAP-Trends/1.0",
    },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) throw new Error(`CDC release request failed with status ${response.status}`);
  const rows = await response.json() as Record<string, unknown>[];
  const row = rows[0] ?? {};
  return {
    population: numeric(row.totalpopulation),
    diabetes: numeric(row.diabetes_crudeprev),
    highBloodPressure: numeric(row.bphigh_crudeprev),
    uninsured: numeric(row.access2_crudeprev),
  };
}

export async function GET(request: NextRequest) {
  const rate = checkPublicRateLimit(request.headers, "county-trends", 50);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Trend requests are arriving too quickly. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter), "Cache-Control": "no-store" } },
    );
  }
  const fips = request.nextUrl.searchParams.get("fips") ?? "";
  const county = /^\d{5}$/.test(fips) ? countiesByFips.get(fips) : null;
  if (!county) return NextResponse.json({ error: "A valid county FIPS is required." }, { status: 400 });

  const settled = await Promise.allSettled(
    releases.map(async (release) => ({ ...release, ...(await releaseProfile(release.dataset, fips)) })),
  );
  const data = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (!data.length) {
    return NextResponse.json(
      { error: "Historical CDC release comparisons are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json({
    county: { fips: county.fips, name: county.county, state: county.state },
    releases: data,
    partial: data.length !== releases.length,
    source: {
      label: "CDC PLACES county GIS-friendly releases, 2022–2025",
      url: "https://www.cdc.gov/places/",
      boundary: "Release-to-release comparison, not a continuous observed series. Confirm measure definitions and underlying years before drawing conclusions.",
    },
  }, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
