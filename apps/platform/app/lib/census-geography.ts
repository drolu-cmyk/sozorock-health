type SupportedCensusKind = "place" | "locality" | "zcta";

type CensusFeature = {
  attributes?: Record<string, string | number | null>;
};

type CensusFetchInit = RequestInit & {
  next?: { revalidate: number };
};

type CensusFetch = (input: string, init?: CensusFetchInit) => Promise<Response>;

type CensusLayer = {
  url: string;
  identifier: "GEOID" | "ZCTA5";
  label: string;
  outFields: string;
};

export type CensusGeographyLookup =
  | {
      status: "found";
      name: string;
      stateFips: string;
      contextLabel: string;
      sourceUrl: string;
    }
  | { status: "not-found" }
  | { status: "unavailable" };

const TIGER_BASE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb";
const PLACE_BASE = `${TIGER_BASE}/Places_CouSub_ConCity_SubMCD/MapServer`;
const ZCTA_LAYER = `${TIGER_BASE}/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1`;

const layersByKind: Record<SupportedCensusKind, CensusLayer[]> = {
  place: [
    { url: `${PLACE_BASE}/4`, identifier: "GEOID", label: "Census place", outFields: "BASENAME,NAME,GEOID,STATE" },
    { url: `${PLACE_BASE}/5`, identifier: "GEOID", label: "Census place", outFields: "BASENAME,NAME,GEOID,STATE" },
  ],
  locality: [
    { url: `${PLACE_BASE}/1`, identifier: "GEOID", label: "Town or county subdivision", outFields: "BASENAME,NAME,GEOID,STATE" },
    { url: `${PLACE_BASE}/3`, identifier: "GEOID", label: "Consolidated city", outFields: "BASENAME,NAME,GEOID,STATE" },
  ],
  zcta: [
    { url: ZCTA_LAYER, identifier: "ZCTA5", label: "Census ZIP Code Tabulation Area (ZCTA)", outFields: "ZCTA5,GEOID,NAME" },
  ],
};

async function queryExactLayer(
  layer: CensusLayer,
  geoid: string,
  fetcher: CensusFetch,
) {
  const params = new URLSearchParams({
    f: "json",
    where: `${layer.identifier} = '${geoid}'`,
    outFields: layer.outFields,
    returnGeometry: "false",
    resultRecordCount: "1",
  });
  const response = await fetcher(`${layer.url}/query?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SozoRock-CB-CAP-Geography-Validation/1.0",
    },
    next: { revalidate: 604800 },
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) throw new Error(`Census geography validation failed with status ${response.status}`);
  const body = await response.json() as { features?: CensusFeature[]; error?: unknown };
  if (body.error) throw new Error("Census geography validation returned an error");
  const feature = body.features?.find(({ attributes = {} }) => (
    String(attributes[layer.identifier] ?? attributes.GEOID ?? "").padStart(geoid.length, "0") === geoid
  ));
  return feature ? { layer, feature } : null;
}

export async function lookupCensusGeography(
  kind: SupportedCensusKind,
  geoid: string,
  fetcher: CensusFetch = fetch as CensusFetch,
): Promise<CensusGeographyLookup> {
  const settled = await Promise.allSettled(
    layersByKind[kind].map((layer) => queryExactLayer(layer, geoid, fetcher)),
  );
  const match = settled.flatMap((result) => (
    result.status === "fulfilled" && result.value ? [result.value] : []
  ))[0];
  if (match) {
    const attributes = match.feature.attributes ?? {};
    const stateFips = kind === "zcta"
      ? ""
      : String(attributes.STATE ?? geoid.slice(0, 2)).padStart(2, "0");
    const sourceName = String(attributes.NAME ?? attributes.BASENAME ?? "").trim();
    return {
      status: "found",
      name: kind === "zcta" ? `ZIP-linked area ${geoid}` : sourceName,
      stateFips,
      contextLabel: match.layer.label,
      sourceUrl: match.layer.url,
    };
  }
  return settled.some((result) => result.status === "rejected")
    ? { status: "unavailable" }
    : { status: "not-found" };
}
