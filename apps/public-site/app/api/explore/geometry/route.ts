import { NextRequest, NextResponse } from "next/server";
import { createRequire } from "node:module";
import { enforceEvidenceRateLimit } from "../../../lib/evidence-rate-limit";
import { safeGeoid, type ExploreKind } from "../../../lib/explore-health";

export const runtime = "nodejs";

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{ geometry?: { coordinates?: unknown } }>;
};

const emptyCollection: FeatureCollection = { type: "FeatureCollection", features: [] };
const UPSTREAM_TIMEOUT_MS = 8_000;
const UPSTREAM_MAX_BYTES = 2_000_000;
const MAX_FEATURES = 25;
const MAX_COORDINATE_POINTS = 250_000;
const MAX_COORDINATE_DEPTH = 12;
const countyBoundaries = createRequire(import.meta.url)(
  "../../../../../../packages/evidence-core/data/national/county-boundaries.v2025.json",
) as {
  censusVintage: string;
  sourceUrl: string;
  generalization: string;
  byGeoid: Record<string, FeatureCollection["features"][number]>;
};

function collectNumbers(value: unknown, points: number[][], depth = 0) {
  if (depth > MAX_COORDINATE_DEPTH || points.length >= MAX_COORDINATE_POINTS) return;
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && value.every((item) => typeof item === "number")) {
    points.push(value as number[]);
    return;
  }
  value.forEach((item) => collectNumbers(item, points, depth + 1));
}

function bounds(collection: FeatureCollection) {
  const points: number[][] = [];
  collection.features.forEach((feature) =>
    collectNumbers(feature.geometry?.coordinates, points),
  );
  if (!points.length) return null;
  return points.reduce(
    (extent, point) => [
      Math.min(extent[0], point[0]),
      Math.min(extent[1], point[1]),
      Math.max(extent[2], point[0]),
      Math.max(extent[3], point[1]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

async function arcGisGeoJson(url: string, parameters: Record<string, string>) {
  const query = new URL(url);
  Object.entries({
    f: "geojson",
    returnGeometry: "true",
    outSR: "4326",
    ...parameters,
  }).forEach(([key, value]) => query.searchParams.set(key, value));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(query, {
      headers: {
        Accept: "application/geo+json,application/json",
        "User-Agent": "SozoRock-Health-Place-Evidence/1.0",
      },
      signal: controller.signal,
      next: { revalidate: 604_800 },
    });
    if (!response.ok) return emptyCollection;
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > UPSTREAM_MAX_BYTES) return emptyCollection;
    if (!response.body) return emptyCollection;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > UPSTREAM_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        return emptyCollection;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const data = JSON.parse(new TextDecoder().decode(bytes)) as FeatureCollection;
    return data.type === "FeatureCollection"
      && Array.isArray(data.features)
      && data.features.length <= MAX_FEATURES
      ? data
      : emptyCollection;
  } catch {
    return emptyCollection;
  } finally {
    clearTimeout(timeout);
  }
}

async function areaGeometry(kind: ExploreKind, geoid: string) {
  if (kind === "county") {
    const feature = countyBoundaries.byGeoid[geoid];
    return feature
      ? { type: "FeatureCollection" as const, features: [feature] }
      : emptyCollection;
  }
  if (kind === "zip") {
    return arcGisGeoJson(
      "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query",
      { where: `ZCTA5='${geoid}'`, outFields: "GEOID,ZCTA5", maxAllowableOffset: "0.0004" },
    );
  }
  const base = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer";
  const incorporated = await arcGisGeoJson(`${base}/4/query`, {
    where: `GEOID='${geoid}'`,
    outFields: "GEOID,NAME",
    maxAllowableOffset: "0.0004",
  });
  if (incorporated.features.length) return incorporated;
  return arcGisGeoJson(`${base}/5/query`, {
    where: `GEOID='${geoid}'`,
    outFields: "GEOID,NAME",
    maxAllowableOffset: "0.0004",
  });
}

export async function GET(request: NextRequest) {
  const kindValue = request.nextUrl.searchParams.get("kind");
  const kind =
    kindValue === "county" || kindValue === "place" || kindValue === "zip"
      ? kindValue
      : null;
  if (!kind) return NextResponse.json({ area: emptyCollection, verifiedResources: emptyCollection });
  const geoid = safeGeoid(kind, request.nextUrl.searchParams.get("geoid") ?? "");
  if (!geoid) return NextResponse.json({ area: emptyCollection, verifiedResources: emptyCollection });
  const rate = await enforceEvidenceRateLimit(request);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Geometry rate limit reached." },
      { status: rate.retryAfter ? 429 : 503, headers: rate.retryAfter ? { "Retry-After": String(rate.retryAfter) } : undefined },
    );
  }
  const area = await areaGeometry(kind, geoid);
  const contextKindValue = request.nextUrl.searchParams.get("contextKind");
  const contextKind = contextKindValue === "county" || contextKindValue === "place" || contextKindValue === "zip"
    ? contextKindValue
    : null;
  const contextGeoid = contextKind
    ? safeGeoid(contextKind, request.nextUrl.searchParams.get("contextGeoid") ?? "")
    : "";
  const contextArea = contextKind && contextGeoid && (contextKind !== kind || contextGeoid !== geoid)
    ? await areaGeometry(contextKind, contextGeoid)
    : emptyCollection;
  return NextResponse.json(
    {
      area,
      contextArea,
      bounds: bounds(area),
      verifiedResources: emptyCollection,
      vintage: `U.S. Census Bureau TIGERweb, January 1, ${countyBoundaries.censusVintage}`,
      sourceUrl: countyBoundaries.sourceUrl,
      geometryNote: countyBoundaries.generalization,
      resourceNote: "No verified SozoRock or community resource markers are published for this geography.",
      contextNote: contextArea.features.length
        ? "The outline shows the original ZIP Code Tabulation Area or Census place used to resolve this county. It is context only; every displayed observation remains county-level."
        : null,
    },
    { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } },
  );
}
