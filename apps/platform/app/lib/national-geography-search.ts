import {
  availabilityForGeography,
  COMMITTED_GEOGRAPHY_SOURCE_FALLBACK,
  COMMITTED_INDICATOR_SOURCE_FALLBACK,
  identifiersForGeography,
  TIGERWEB_CURRENT_SOURCE,
} from "./geography-provenance.ts";
import { repairPublicDataText } from "./text-normalization.ts";
import type {
  CountyPlanningRecord,
  GeographySourceReference,
  VerifiedGeographySuggestion,
} from "./types";

type SearchState = {
  fips: string;
  name: string;
  code: string;
};

type SearchCounty = Pick<
  CountyPlanningRecord,
  "fips" | "stateFips" | "state" | "county" | "sourceStatus"
>;

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
  orderByField: "BASENAME" | "ZCTA5";
  geoidLength: 5 | 7 | 10;
};

export type NationalGeographySearchResult = {
  results: VerifiedGeographySuggestion[];
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
    orderByField: "BASENAME",
    geoidLength: 10,
  },
  {
    url: `${PLACE_BASE}/3/query`,
    kind: "locality",
    identifier: "GEOID",
    label: "Consolidated city",
    outFields: "BASENAME,NAME,GEOID,STATE,CONCITY",
    orderByField: "BASENAME",
    geoidLength: 7,
  },
  {
    url: `${PLACE_BASE}/4/query`,
    kind: "place",
    identifier: "GEOID",
    label: "Incorporated place",
    outFields: "BASENAME,NAME,GEOID,STATE,PLACE",
    orderByField: "BASENAME",
    geoidLength: 7,
  },
  {
    url: `${PLACE_BASE}/5/query`,
    kind: "place",
    identifier: "GEOID",
    label: "Census-designated place",
    outFields: "BASENAME,NAME,GEOID,STATE,PLACE",
    orderByField: "BASENAME",
    geoidLength: 7,
  },
  {
    url: `${TIGER_BASE}/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query`,
    kind: "zcta",
    identifier: "ZCTA5",
    label: "Census ZCTA",
    outFields: "ZCTA5,GEOID,NAME",
    orderByField: "ZCTA5",
    geoidLength: 5,
  },
];

function normalizedSearchText(value: string) {
  return value
    .replaceAll("''", "'")
    .replace(/[,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function stateName(states: SearchState[], stateFips: string) {
  return states.find((state) => state.fips === stateFips)?.name ?? "United States";
}

function splitStateQualifier(term: string, states: SearchState[]) {
  const normalized = normalizedSearchText(term);
  const exactState = states.find((state) => (
    state.code.toUpperCase() === normalized
    || state.name.toUpperCase() === normalized
    || state.fips === normalized
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

function countyRank(countyName: string, searchName: string) {
  const withoutSuffix = countyName.replace(
    / (COUNTY|PARISH|BOROUGH|MUNICIPIO|CENSUS AREA)$/,
    "",
  );
  if (countyName === searchName || withoutSuffix === searchName) return 0;
  if (countyName.startsWith(searchName)) return 2;
  return 4;
}

function suggestionName(value: string) {
  return normalizedSearchText(value)
    .replace(/^ZIP-LINKED AREA /, "")
    .replace(/ (CITY|TOWN|VILLAGE|BOROUGH|CDP|CCD|COUNTY|PARISH|MUNICIPIO|CENSUS AREA)$/, "");
}

function suggestionRank(
  suggestion: VerifiedGeographySuggestion,
  term: string,
  states: SearchState[],
) {
  const normalized = normalizedSearchText(term);
  const numeric = /^\d{2,10}$/.test(normalized);
  if (numeric) {
    if (suggestion.geoid === normalized) {
      if (normalized.length === 2 && suggestion.kind === "state") return 0;
      if (normalized.length === 5 && suggestion.kind === "zcta") return 0;
      if (normalized.length === 5 && suggestion.kind === "county") return 1;
      return 2;
    }
    return suggestion.geoid.startsWith(normalized) ? 20 : 40;
  }

  const qualified = splitStateQualifier(normalized, states);
  const fullLabel = normalizedSearchText(suggestion.label);
  const baseLabel = suggestionName(suggestion.label);
  const exactName = fullLabel === qualified.name || baseLabel === qualified.name;
  const kindRank = suggestion.kind === "place"
    ? 0
    : suggestion.kind === "county"
      ? 1
      : suggestion.kind === "locality"
        ? 2
        : suggestion.kind === "state"
          ? 3
          : 4;
  return (exactName ? 0 : 20) + kindRank;
}

function committedProfileSource(
  kind: "state" | "county",
  source: GeographySourceReference,
  hasCommittedIndicators = false,
) {
  if (kind === "state") {
    return {
      ...source,
      method: "Population-weighted state summary derived from committed county-level CDC PLACES estimates.",
    };
  }
  return hasCommittedIndicators
    ? { ...source, method: "Exact county FIPS match in the committed CDC PLACES snapshot." }
    : null;
}

export function searchCommittedGeographies(
  term: string,
  states: SearchState[],
  counties: SearchCounty[],
  source: GeographySourceReference = COMMITTED_GEOGRAPHY_SOURCE_FALLBACK,
  indicatorSource: GeographySourceReference = COMMITTED_INDICATOR_SOURCE_FALLBACK,
) {
  const normalized = normalizedSearchText(term);
  const numeric = /^\d{2,10}$/.test(normalized);
  const qualified = splitStateQualifier(normalized, states);
  const results: VerifiedGeographySuggestion[] = [];

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
      identifiers: identifiersForGeography("state", state.fips, state.fips),
      dataAvailability: availabilityForGeography("state", true),
      source,
      profileSource: committedProfileSource("state", indicatorSource),
    });
  }

  if (!qualified.exactState) {
    const matchingCounties = counties.flatMap((county) => {
      const name = normalizedSearchText(county.county);
      const numericMatch = numeric && normalized.length <= 5 && county.fips.startsWith(normalized);
      const nameMatch = !numeric
        && (!qualified.stateFips || county.stateFips === qualified.stateFips)
        && name.includes(qualified.name);
      if (!numericMatch && !nameMatch) return [];
      return [{
        county,
        rank: numeric ? county.fips === normalized ? 0 : 4 : countyRank(name, qualified.name),
      }];
    }).sort((left, right) => (
      left.rank - right.rank
      || left.county.state.localeCompare(right.county.state)
      || left.county.county.localeCompare(right.county.county)
    )).slice(0, 10);

    for (const { county } of matchingCounties) {
      results.push({
        id: `county-${county.fips}`,
        kind: "county",
        label: county.county,
        context: `${county.state} · County FIPS ${county.fips}`,
        geoid: county.fips,
        stateFips: county.stateFips,
        identifiers: identifiersForGeography("county", county.fips, county.stateFips),
        dataAvailability: availabilityForGeography(
          "county",
          county.sourceStatus === "available",
        ),
        source,
        profileSource: committedProfileSource(
          "county",
          indicatorSource,
          county.sourceStatus === "available",
        ),
      });
    }
  }

  return results;
}

export function remoteWhereForLayer(layer: RemoteLayer, term: string, states: SearchState[]) {
  const normalized = normalizedSearchText(term);
  const qualified = splitStateQualifier(normalized, states);
  if (qualified.exactState) return null;
  if (!/^\d{2,10}$/.test(normalized)) {
    if (layer.kind === "zcta") return null;
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
    orderByFields: layer.orderByField,
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
): VerifiedGeographySuggestion | null {
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
    : repairPublicDataText(String(attributes.NAME ?? attributes.BASENAME ?? layer.label));
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
    identifiers: identifiersForGeography(layer.kind, geoid, stateFips),
    dataAvailability: availabilityForGeography(layer.kind),
    source: TIGERWEB_CURRENT_SOURCE,
    profileSource: null,
  };
}

export async function searchNationalGeographies({
  term,
  states,
  counties,
  committedSource = COMMITTED_GEOGRAPHY_SOURCE_FALLBACK,
  committedIndicatorSource = COMMITTED_INDICATOR_SOURCE_FALLBACK,
  fetcher = fetch as CensusFetch,
}: {
  term: string;
  states: SearchState[];
  counties: SearchCounty[];
  committedSource?: GeographySourceReference;
  committedIndicatorSource?: GeographySourceReference;
  fetcher?: CensusFetch;
}): Promise<NationalGeographySearchResult> {
  const local = searchCommittedGeographies(
    term,
    states,
    counties,
    committedSource,
    committedIndicatorSource,
  );
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
    .sort((left, right) => (
      suggestionRank(left, term, states) - suggestionRank(right, term, states)
      || left.label.localeCompare(right.label)
      || left.geoid.localeCompare(right.geoid)
    ))
    .slice(0, 20);
  const remoteUnavailable = plans.length > 0
    && settled.every((result) => result.status === "rejected");
  return {
    results: combined,
    partial: settled.some((result) => result.status === "rejected"),
    remoteUnavailable,
  };
}
