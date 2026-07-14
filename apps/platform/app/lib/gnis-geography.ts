type GnisFeature = {
  attributes?: {
    gaz_id?: number | string | null;
    gaz_name?: string | null;
    gaz_featureclass?: string | null;
    state_alpha?: string | null;
    county_name?: string | null;
  };
};

type GnisFetchInit = RequestInit & {
  next?: { revalidate: number };
};

type GnisFetch = (input: string, init?: GnisFetchInit) => Promise<Response>;

export type GnisCommunityLookup =
  | {
      status: "found";
      gnisId: string;
      name: string;
      stateCode: string;
      countyName: string;
      sourceUrl: string;
    }
  | { status: "not-found" }
  | { status: "unavailable" };

export const GNIS_POPULATED_PLACES_LAYER =
  "https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/3";

export async function lookupGnisCommunity(
  gnisId: string,
  fetcher: GnisFetch = fetch as GnisFetch,
): Promise<GnisCommunityLookup> {
  const params = new URLSearchParams({
    f: "json",
    where: `gaz_id = ${gnisId}`,
    outFields: "gaz_id,gaz_name,gaz_featureclass,state_alpha,county_name",
    returnGeometry: "false",
    resultRecordCount: "1",
  });
  let response: Response;
  try {
    response = await fetcher(`${GNIS_POPULATED_PLACES_LAYER}/query?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SozoRock-CB-CAP-GNIS-Validation/1.0",
      },
      next: { revalidate: 604800 },
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) return { status: "unavailable" };
    const body = await response.json() as { features?: GnisFeature[]; error?: unknown };
    if (body.error) return { status: "unavailable" };
    const feature = body.features?.find(({ attributes = {} }) => (
      String(attributes.gaz_id ?? "") === gnisId
      && attributes.gaz_featureclass === "Populated Place"
    ));
    const attributes = feature?.attributes;
    const name = String(attributes?.gaz_name ?? "").trim();
    const stateCode = String(attributes?.state_alpha ?? "").trim().toUpperCase();
    if (!feature || !name || !/^[A-Z]{2}$/.test(stateCode)) return { status: "not-found" };
    return {
      status: "found",
      gnisId,
      name,
      stateCode,
      countyName: String(attributes?.county_name ?? "").trim(),
      sourceUrl: GNIS_POPULATED_PLACES_LAYER,
    };
  } catch {
    return { status: "unavailable" };
  }
}
