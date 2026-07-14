import type {
  GeographyDataAvailability,
  GeographyIdentifiers,
  GeographyKind,
  GeographySourceReference,
  SourceManifest,
} from "./types";

export const TIGERWEB_CURRENT_SOURCE: GeographySourceReference = {
  agency: "U.S. Census Bureau",
  dataset: "TIGERweb Places, County Subdivisions, Consolidated Cities, and ZCTAs",
  vintage: "Current TIGERweb service",
  url: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb",
  method: "Live authoritative name or identifier lookup; responses are cached for up to seven days.",
  freshness: "Queried on demand from the current TIGERweb service; cache may be up to seven days old.",
  refreshedAt: null,
};

export const USGS_GNIS_SOURCE: GeographySourceReference = {
  agency: "U.S. Geological Survey",
  dataset: "Geographic Names Information System (GNIS) populated places",
  vintage: "Current GNIS public service",
  url: "https://www.usgs.gov/tools/geographic-names-information-system-gnis",
  method: "On-demand official-name lookup for populated communities not represented by a current Census place or county-subdivision result.",
  freshness: "Queried on demand from the current USGS public service; search responses are cached for up to seven days.",
  refreshedAt: null,
};

export const COMMITTED_GEOGRAPHY_SOURCE_FALLBACK: GeographySourceReference = {
  agency: "U.S. Census Bureau",
  dataset: "Committed TIGERweb state and county snapshot",
  vintage: "Snapshot metadata supplied by the API",
  url: "https://tigerweb.geo.census.gov/",
  method: "Committed nationwide state and county snapshot.",
  freshness: "Snapshot freshness is supplied by the API response.",
  refreshedAt: null,
};

export const COMMITTED_INDICATOR_SOURCE_FALLBACK: GeographySourceReference = {
  agency: "Centers for Disease Control and Prevention",
  dataset: "Committed CDC PLACES county snapshot",
  vintage: "Snapshot metadata supplied by the API",
  url: "https://data.cdc.gov/",
  method: "Committed county-level modeled estimates.",
  freshness: "Snapshot freshness is supplied by the API response.",
  refreshedAt: null,
};

export function committedCountySource(manifest: SourceManifest): GeographySourceReference {
  return {
    agency: "U.S. Census Bureau",
    dataset: manifest.geography.source,
    vintage: manifest.geography.vintage,
    url: manifest.geography.url,
    method: "Committed nationwide state and county snapshot produced by the reproducible CB-CAP refresh pipeline.",
    freshness: `Snapshot generated ${manifest.generatedAt} from the ${manifest.geography.vintage} Census vintage.`,
    refreshedAt: manifest.generatedAt,
  };
}

export function committedIndicatorSnapshot(manifest: SourceManifest): GeographySourceReference {
  return {
    agency: "Centers for Disease Control and Prevention",
    dataset: manifest.indicators.source,
    vintage: manifest.indicators.released,
    url: manifest.indicators.url,
    method: "Committed county-level CDC PLACES modeled-estimate snapshot.",
    freshness: `Committed CB-CAP snapshot generated ${manifest.generatedAt}; source release ${manifest.indicators.released}.`,
    refreshedAt: manifest.generatedAt,
  };
}

export function identifiersForGeography(
  kind: GeographyKind,
  geoid: string,
  stateFips: string,
): GeographyIdentifiers {
  return {
    geoid,
    stateFips,
    countyFips: kind === "county" ? geoid.slice(2) : null,
    placeFips: kind === "place" ? geoid.slice(2) : null,
    zcta: kind === "zcta" ? geoid : null,
    ...(kind === "community" ? { gnisId: geoid } : {}),
  };
}

export function availabilityForGeography(
  kind: GeographyKind,
  hasCommittedIndicators = false,
): GeographyDataAvailability {
  if (kind === "state") return "derived-county-summary-available";
  if (kind === "county" && hasCommittedIndicators) return "official-modeled-estimates-available";
  if (kind === "county" || kind === "locality" || kind === "community") return "official-geography-only";
  return "checked-on-selection";
}
