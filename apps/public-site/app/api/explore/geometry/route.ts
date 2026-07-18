import { NextRequest, NextResponse } from "next/server";
import { safeGeoid, type ExploreKind } from "../../../lib/explore-health";

export const runtime = "nodejs";

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{ geometry?: { coordinates?: unknown } }>;
};

const emptyCollection: FeatureCollection = { type: "FeatureCollection", features: [] };

function collectNumbers(value: unknown, points: number[][]) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && value.every((item) => typeof item === "number")) {
    points.push(value as number[]);
    return;
  }
  value.forEach((item) => collectNumbers(item, points));
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
  const response = await fetch(query, {
    headers: {
      Accept: "application/geo+json,application/json",
      "User-Agent": "SozoRock-Health-Place-Evidence/1.0",
    },
    next: { revalidate: 604_800 },
  });
  if (!response.ok) return emptyCollection;
  const data = (await response.json()) as FeatureCollection;
  return data.type === "FeatureCollection" ? data : emptyCollection;
}

async function areaGeometry(kind: ExploreKind, geoid: string) {
  if (kind === "county") {
    return arcGisGeoJson(
      "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/9/query",
      { where: `GEOID='${geoid}'`, outFields: "GEOID,NAME", maxAllowableOffset: "0.0005" },
    );
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

async function roadGeometry(extent: number[] | null) {
  if (!extent) return emptyCollection;
  const envelope = extent.join(",");
  const shared = {
    where: "1=1",
    outFields: "NAME,RTTYP",
    geometry: envelope,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    resultRecordCount: "700",
    maxAllowableOffset: "0.001",
  };
  const base = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer";
  const [interstates, highways] = await Promise.all([
    arcGisGeoJson(`${base}/0/query`, shared),
    arcGisGeoJson(`${base}/3/query`, shared),
  ]);
  return {
    type: "FeatureCollection" as const,
    features: [...interstates.features, ...highways.features],
  };
}

export async function GET(request: NextRequest) {
  const kindValue = request.nextUrl.searchParams.get("kind");
  const kind =
    kindValue === "county" || kindValue === "place" || kindValue === "zip"
      ? kindValue
      : null;
  if (!kind) return NextResponse.json({ area: emptyCollection, roads: emptyCollection });
  const geoid = safeGeoid(kind, request.nextUrl.searchParams.get("geoid") ?? "");
  if (!geoid) return NextResponse.json({ area: emptyCollection, roads: emptyCollection });
  const area = await areaGeometry(kind, geoid);
  const roads = await roadGeometry(bounds(area));
  return NextResponse.json(
    { area, roads, vintage: "U.S. Census Bureau TIGERweb, January 1, 2025" },
    { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } },
  );
}
