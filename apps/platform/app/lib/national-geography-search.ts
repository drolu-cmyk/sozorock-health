import type { CountyPlanningRecord, GeographySuggestion } from "./types";

type SearchState = {
  fips: string;
  name: string;
  code: string;
};

type SearchCounty = Pick<CountyPlanningRecord, "fips" | "stateFips" | "state" | "county">;

type CensusFeature = { attributes?: Record<string, string | number | null> };

type CensusFetchInit = RequestInit & {
  next?: { revalidate: number };
};

type CensusFetch = (input: string, init?: CensusFetchInit) => Promise<Response>;

type RemoteLayer = {
  url: string;
  kind: "place" | "locality" | "zcta";
  identifier: "GEOID" | "ZCTA5";
  label: string;
  outFields: string;
  geoidLength: 5 | 7 | 10;
};

export type NationalGeographySearchResult = {
  results: GeographySuggestion[];
  partial: boolean;
  remoteUnavailable: boolean;
};

const TIGER_BASE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb";
const PLACE_BASE = `${TIGER_BASE}/Places_CouSub_ConCity_SubMCD/MapServer`;

const remoteLayers: RemoteLayer[] = [
  {
    url: `${PLACE_BASE}/1/query`,
    kind: "locality",
    identifier: "GEOID",
    label: "Town or county subdivision",
    outFields: "BASENAME,NAME,GEOID,STATE,COUNTY,COUSUB",
    geoidLength: 10,
  },
  {
    url: `${PLACE_BASE}/3/query`,
    kind: "locality",
    identifier: "GEOID",
    label: "Consolidated city",
    outFields: "BASENAME,NAME,GEOID,STATE,CONCITY",
    geoidLength: 7,
  },
  {
    url: `${PLACE_BASE}/4/query`,
    kind: "place",
    identifier: "GEOID",
    label: "Census place",
    outFields: "BASENAME,NAME,GEOID,STATE,PLACE",
    geoidLength: 7,
  },
  {
    url: `${PLACE_BASE}/5/query`,
    kind: "place",
    identifier: "GEOID",
    label: "Census place",
    outFields: "BASENAME,NAME,GEOID,STATE,PLACE",
    geoidLength: 7,
  },
  {
    url: `${TIGER_BASE}/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query`,
    kind: "zcta",
    identifier: "ZCTA5",
    label: "Census ZCTA",
    outFields: "ZCTA5,GEOID,NAME",
    geoidLength: 5,
  },
];

function normalizedSearchText(value: string) {
  return value.replaceAll("''", "'").replace(/\s+/g, " ").trim().toUpperCase();
}
function stateName(states: SearchState[], stateFips: string) {
  return states.find((state) => state.fips === stateFips)?.name ?? "United States";
}

function splitStateQualifier(term: string, states: SearchState[]) {
  const normalized = normalizedSearchText(term);
  const exactState = states.find((state) => (
    state.code.toUpperCase() === normalized || state.name.toUpperCase() === normalized
  ));
  if (exactState) return { name: normalized, stateFips: "", exactState };

  const qualifier = [...states]
    .sort((left, right) => right.name.length - left.name.length)
    .find((state) => (
      normalized.endsWith(` ${state.code.toUpperCase()}`)
      || normalized.endsWith(` ${state.name.toUpperCase()}`)
    ));
  if (!qualifier) return { name: normalized, stateFips: "", exactState: null };
  const suffixLength = normalized.endsWith(` ${qualifier.code.toUpperCase()}`)
    ? qualifier.code.length + 1
    : qualifier.name.length + 1;
  const name = normalized.slice(0, -suffixLength).trim();
  return name.length >= 2
    ? { name, stateFips: qualifier.fips, exactState: null }
    : { name: normalized, stateFips: "", exactState: null };
}

export function searchCommittedGeographies(
  term: string,
  states: SearchState[],
  counties: SearchCounty[],
) {
  const normalized = normalizedSearchText(term);
  const numeric = /^\d{2,10}$/.test(normalized);
  const qualified = splitStateQualifier(normalized, states);
  const results: GeographySuggestion[] = [];

  for (const state of states) {
    const stateMatches = numeric
      ? normalized.length === 2 && state.fips === normalized
      : !qualified.stateFips && (
          state.code.toUpperCase() === normalized
          || state.name.toUpperCase().startsWith(normalized)
        );
    if (!stateMatches) continue;
    results.push({
      id: `state-${state.fips}`,
      kind: "state",
      label: state.name,
      context: `State · FIPS ${state.fips}`,
      geoid: state.fips,
      stateFips: state.fips,
    });
  }

  if (!qualified.exactState) {
    for (const county of counties) {
      const countyMatches = numeric
        ? normalized.length <= 5 && county.fips.startsWith(normalized)
        : (!qualified.stateFips || county.stateFips === qualified.stateFips)
          && county.county.toUpperCase().includes(qualified.name);
      if (!countyMatches) continue;
      results.push({
        id: `county-${county.fips}`,
        kind: "county",
        label: county.county,
        context: `${county.state} · County FIPS ${county.fips}`,
        geoid: county.fips,
        stateFips: county.stateFips,
      });
      if (results.length >= 8) break;
    }
  }

  return results;
}

export function remoteWhereForLayer(layer: RemoteLayer, term: string, states: SearchState[]) {
  const normalized = normalizedSearchText(term);
  const qualified = splitStateQualifier(normalized, states);
  if (qualified.exactState) return null;
  if (!/^\d{2,10}$/.test(normalized)) {
    const stateRestriction = qualified.stateFips ? ` AND STATE = '${qualified.stateFips}'` : "";
    return `UPPER(BASENAME) LIKE '${qualified.name.replaceAll("'", "''")}%'${stateRestriction}`;
  }
  if (normalized.length > layer.geoidLength) return null;
  return normalized.length === layer.geoidLength
    ? `${layer.identifier} = '${normalized}'`
    : `${layer.identifier} LIKE '${normalized}%'`;
}

async function queryLayer(
  layer: RemoteLayer,
  where: string,
  fetcher: CensusFetch,
) {
  const params = new URLSearchParams({
    f: "json",
    where,
    outFields: layer.outFields,
    returnGeometry: "false",
    resultRecordCount: "12",
    orderByFields: "BASENAME",
  });
  const response = await fetcher(`${layer.url}?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SozoRock-CB-CAP-Geography/1.0",
    },
    next: { revalidate: 604800 },
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) throw new Error(`Census geography request failed with status ${response.status}`);
  const body = await response.json() as { features?: CensusFeature[]; error?: unknown };
  if (body.error) throw new Error("Census geography search returned an error");
  return body.features ?? [];
}

function suggestionFromFeature(
  layer: RemoteLayer,
  feature: CensusFeature,
  states: SearchState[],
): GeographySuggestion | null {
  const attributes = feature.attributes ?? {};
  const geoid = String(attributes[layer.identifier] ?? attributes.GEOID ?? "")
    .padStart(layer.geoidLength, "0");
  if (!/^\d{5,10}$/.test(geoid)) return null;
  const stateFips = layer.kind === "zcta"
    ? ""
    : String(attributes.STATE ?? geoid.slice(0, 2)).padStart(2, "0");
  if (layer.kind !== "zcta" && !states.some((state) => state.fips === stateFips)) return null;
  const label = layer.kind === "zcta"
    ? `ZIP-linked area ${geoid}`
    : String(attributes.NAME ?? attributes.BASENAME ?? layer.label);
  const context = layer.kind === "zcta"
    ? "Census ZCTA · not a USPS delivery route"
    : `${stateName(states, stateFips)} · ${layer.label} GEOID ${geoid}`;
  return {
    id: `${layer.kind}-${geoid}`,
    kind: layer.kind,
    label,
    context,
    geoid,
    stateFips,
  };
}

export async function searchNationalGeographies({
  term,
  states,
  counties,
  fetcher = fetch as CensusFetch,
}: {
  term: string;
  states: SearchState[];
  counties: SearchCounty[];
  fetcher?: CensusFetch;
}): Promise<NationalGeographySearchResult> {
  const local = searchCommittedGeographies(term, states, counties);
  const plans = remoteLayers.flatMap((layer) => {
    const where = remoteWhereForLayer(layer, term, states);
    return where ? [{ layer, where }] : [];
  });
  const settled = await Promise.allSettled(
    plans.map(async ({ layer, where }) => ({
      layer,
      features: await queryLayer(layer, where, fetcher),
    })),
  );
  const remote = settled.flatMap((result) => {
    if (result.status !== "fulfilled") return [];
    return result.value.features.flatMap((feature) => {
      const suggestion = suggestionFromFeature(result.value.layer, feature, states);
      return suggestion ? [suggestion] : [];
    });
  });
  const combined = [...local, ...remote]
    .filter((result, index, all) => all.findIndex((candidate) => candidate.id === result.id) === index)
    .slice(0, 20);
  const remoteUnavailable = plans.length > 0
    && settled.every((result) => result.status === "rejected");
  return {
    results: combined,
    partial: settled.some((result) => result.status === "rejected"),
    remoteUnavailable,
  };
}
