import { createHash } from "node:crypto";

export const CENSUS_GEOGRAPHY_VINTAGE = "2025";
export const ZCTA_COUNTY_RELATIONSHIP_VINTAGE = "2020";

export const OFFICIAL_GEOGRAPHY_URLS = {
  states: "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_state_national.zip",
  counties: "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_counties_national.zip",
  places: "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip",
  zctas: "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip",
  zctaCountyRelationships: "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt",
} as const;

export type NationalReleaseScope = "primary_50_states_dc" | "extended_territory";

export type NationalGeographyRecord = {
  id: string;
  kind: "state" | "county" | "census_place" | "zcta";
  geoid: string;
  name: string;
  displayName: string;
  stateFips: string | null;
  statePostalCode: string | null;
  countyFips: string | null;
  vintage: string;
  releaseScope: NationalReleaseScope;
  legalStatisticalAreaCode: string | null;
  geographyTypeLabel: string;
  landAreaSquareMeters: number | null;
  waterAreaSquareMeters: number | null;
  internalPoint: { latitude: number; longitude: number } | null;
  geometryStatus: "metadata_only";
  sourceUrl: string;
};

export type NationalGeographyRelationship = {
  id: string;
  fromKind: NationalGeographyRecord["kind"];
  fromGeoid: string;
  toKind: NationalGeographyRecord["kind"];
  toGeoid: string;
  relationship: "member_of" | "overlaps";
  overlapAreaPercent: number | null;
  vintage: string;
  sourceUrl: string;
  caveat: string | null;
};

export type NationalGeographyCatalog = {
  schemaVersion: "sozorock.national-geography.v1";
  generatedAt: string;
  sourceVintage: string;
  relationshipVintage: string;
  sources: Array<{ id: string; url: string; sha256: string; byteLength: number }>;
  jurisdictions: {
    primary: Array<{ geoid: string; postalCode: string; name: string }>;
    extended: Array<{ geoid: string; postalCode: string; name: string; status: string }>;
    islandAreas: Array<{ geoid: string; postalCode: string; name: string; status: string }>;
  };
  geographies: NationalGeographyRecord[];
  relationships: NationalGeographyRelationship[];
};

export function sha256Hex(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableId(...parts: string[]) {
  const hash = sha256Hex(parts.join("|"));
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export function parsePipeTable(input: string) {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split("|").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split("|");
    return Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? "").trim()]));
  });
}

export function countyEquivalentType(name: string) {
  const normalized = name.toLowerCase();
  if (normalized === "district of columbia") return "Federal district";
  if (normalized.endsWith(" parish")) return "Parish";
  if (normalized.endsWith(" census area")) return "Census area";
  if (normalized.endsWith(" city and borough")) return "City and borough";
  if (normalized.endsWith(" borough")) return "Borough";
  if (normalized.endsWith(" municipality")) return "Municipality";
  if (normalized.endsWith(" planning region")) return "Planning region";
  if (normalized.endsWith(" city")) return "Independent city";
  if (normalized.endsWith(" county")) return "County";
  return "County equivalent";
}

function numberOrNull(value: string) {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function point(row: Record<string, string>) {
  const latitude = numberOrNull(row.INTPTLAT);
  const longitude = numberOrNull(row.INTPTLONG);
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

export function buildNationalGeographyCatalog(input: {
  generatedAt: string;
  states: Record<string, string>[];
  counties: Record<string, string>[];
  places: Record<string, string>[];
  zctas: Record<string, string>[];
  zctaCountyRelationships: Record<string, string>[];
  sources: NationalGeographyCatalog["sources"];
}): NationalGeographyCatalog {
  const primaryStates = input.states.filter((row) => row.USPS !== "PR");
  const primaryStateFips = new Set(primaryStates.map((row) => row.GEOID));
  const stateByFips = new Map(input.states.map((row) => [row.GEOID, row]));
  const countyScope = new Map(input.counties.map((row) => [
    row.GEOID,
    primaryStateFips.has(row.GEOID.slice(0, 2)) ? "primary_50_states_dc" : "extended_territory",
  ] as const));

  const zctaScopes = new Map<string, NationalReleaseScope>();
  for (const row of input.zctaCountyRelationships) {
    if (!row.GEOID_ZCTA5_20 || !row.GEOID_COUNTY_20) continue;
    const next = countyScope.get(row.GEOID_COUNTY_20);
    if (!next) continue;
    if (next === "primary_50_states_dc" || !zctaScopes.has(row.GEOID_ZCTA5_20)) {
      zctaScopes.set(row.GEOID_ZCTA5_20, next);
    }
  }

  const geographies: NationalGeographyRecord[] = [];
  for (const row of input.states) {
    geographies.push({
      id: stableId("state", row.GEOID, CENSUS_GEOGRAPHY_VINTAGE),
      kind: "state",
      geoid: row.GEOID,
      name: row.NAME,
      displayName: row.NAME,
      stateFips: row.GEOID,
      statePostalCode: row.USPS,
      countyFips: null,
      vintage: CENSUS_GEOGRAPHY_VINTAGE,
      releaseScope: row.USPS === "PR" ? "extended_territory" : "primary_50_states_dc",
      legalStatisticalAreaCode: null,
      geographyTypeLabel: row.USPS === "DC" ? "Federal district" : row.USPS === "PR" ? "Territory" : "State",
      landAreaSquareMeters: numberOrNull(row.ALAND),
      waterAreaSquareMeters: numberOrNull(row.AWATER),
      internalPoint: point(row),
      geometryStatus: "metadata_only",
      sourceUrl: OFFICIAL_GEOGRAPHY_URLS.states,
    });
  }

  for (const row of input.counties) {
    const stateFips = row.GEOID.slice(0, 2);
    const state = stateByFips.get(stateFips);
    geographies.push({
      id: stableId("county", row.GEOID, CENSUS_GEOGRAPHY_VINTAGE),
      kind: "county",
      geoid: row.GEOID,
      name: row.NAME,
      displayName: `${row.NAME}, ${state?.USPS ?? row.USPS}`,
      stateFips,
      statePostalCode: state?.USPS ?? row.USPS,
      countyFips: row.GEOID,
      vintage: CENSUS_GEOGRAPHY_VINTAGE,
      releaseScope: countyScope.get(row.GEOID) ?? "extended_territory",
      legalStatisticalAreaCode: null,
      geographyTypeLabel: countyEquivalentType(row.NAME),
      landAreaSquareMeters: numberOrNull(row.ALAND),
      waterAreaSquareMeters: numberOrNull(row.AWATER),
      internalPoint: point(row),
      geometryStatus: "metadata_only",
      sourceUrl: OFFICIAL_GEOGRAPHY_URLS.counties,
    });
  }

  for (const row of input.places) {
    const stateFips = row.GEOID.slice(0, 2);
    geographies.push({
      id: stableId("census_place", row.GEOID, CENSUS_GEOGRAPHY_VINTAGE),
      kind: "census_place",
      geoid: row.GEOID,
      name: row.NAME,
      displayName: `${row.NAME}, ${row.USPS}`,
      stateFips,
      statePostalCode: row.USPS,
      countyFips: null,
      vintage: CENSUS_GEOGRAPHY_VINTAGE,
      releaseScope: primaryStateFips.has(stateFips) ? "primary_50_states_dc" : "extended_territory",
      legalStatisticalAreaCode: row.LSAD || null,
      geographyTypeLabel: row.NAME.toLowerCase().endsWith(" cdp") ? "Census-designated place" : "Census place",
      landAreaSquareMeters: numberOrNull(row.ALAND),
      waterAreaSquareMeters: numberOrNull(row.AWATER),
      internalPoint: point(row),
      geometryStatus: "metadata_only",
      sourceUrl: OFFICIAL_GEOGRAPHY_URLS.places,
    });
  }

  for (const row of input.zctas) {
    geographies.push({
      id: stableId("zcta", row.GEOID, CENSUS_GEOGRAPHY_VINTAGE),
      kind: "zcta",
      geoid: row.GEOID,
      name: `ZCTA ${row.GEOID}`,
      displayName: `ZCTA ${row.GEOID}`,
      stateFips: null,
      statePostalCode: null,
      countyFips: null,
      vintage: CENSUS_GEOGRAPHY_VINTAGE,
      releaseScope: zctaScopes.get(row.GEOID) ?? "extended_territory",
      legalStatisticalAreaCode: null,
      geographyTypeLabel: "ZIP Code Tabulation Area",
      landAreaSquareMeters: numberOrNull(row.ALAND),
      waterAreaSquareMeters: numberOrNull(row.AWATER),
      internalPoint: point(row),
      geometryStatus: "metadata_only",
      sourceUrl: OFFICIAL_GEOGRAPHY_URLS.zctas,
    });
  }

  const relationships: NationalGeographyRelationship[] = [];
  for (const county of geographies.filter((record) => record.kind === "county")) {
    relationships.push({
      id: stableId("county-state", county.geoid, county.stateFips ?? "", CENSUS_GEOGRAPHY_VINTAGE),
      fromKind: "county",
      fromGeoid: county.geoid,
      toKind: "state",
      toGeoid: county.stateFips ?? "",
      relationship: "member_of",
      overlapAreaPercent: 100,
      vintage: CENSUS_GEOGRAPHY_VINTAGE,
      sourceUrl: OFFICIAL_GEOGRAPHY_URLS.counties,
      caveat: null,
    });
  }
  for (const place of geographies.filter((record) => record.kind === "census_place")) {
    relationships.push({
      id: stableId("place-state", place.geoid, place.stateFips ?? "", CENSUS_GEOGRAPHY_VINTAGE),
      fromKind: "census_place",
      fromGeoid: place.geoid,
      toKind: "state",
      toGeoid: place.stateFips ?? "",
      relationship: "member_of",
      overlapAreaPercent: 100,
      vintage: CENSUS_GEOGRAPHY_VINTAGE,
      sourceUrl: OFFICIAL_GEOGRAPHY_URLS.places,
      caveat: "A Census place can cross county boundaries; this relationship does not imply county membership.",
    });
  }
  for (const row of input.zctaCountyRelationships) {
    const zcta = row.GEOID_ZCTA5_20;
    const county = row.GEOID_COUNTY_20;
    if (!zcta || !county) continue;
    const zctaLand = numberOrNull(row.AREALAND_ZCTA5_20);
    const overlapLand = numberOrNull(row.AREALAND_PART);
    relationships.push({
      id: stableId("zcta-county", zcta, county, ZCTA_COUNTY_RELATIONSHIP_VINTAGE),
      fromKind: "zcta",
      fromGeoid: zcta,
      toKind: "county",
      toGeoid: county,
      relationship: "overlaps",
      overlapAreaPercent: zctaLand && overlapLand !== null ? Number(((overlapLand / zctaLand) * 100).toFixed(4)) : null,
      vintage: ZCTA_COUNTY_RELATIONSHIP_VINTAGE,
      sourceUrl: OFFICIAL_GEOGRAPHY_URLS.zctaCountyRelationships,
      caveat: "This is the official 2020 Census ZCTA-to-county relationship. A postal ZIP Code is not a ZCTA, and a ZCTA can overlap multiple counties.",
    });
  }

  return {
    schemaVersion: "sozorock.national-geography.v1",
    generatedAt: input.generatedAt,
    sourceVintage: CENSUS_GEOGRAPHY_VINTAGE,
    relationshipVintage: ZCTA_COUNTY_RELATIONSHIP_VINTAGE,
    sources: input.sources,
    jurisdictions: {
      primary: primaryStates.map((row) => ({ geoid: row.GEOID, postalCode: row.USPS, name: row.NAME })),
      extended: input.states
        .filter((row) => row.USPS === "PR")
        .map((row) => ({ geoid: row.GEOID, postalCode: row.USPS, name: row.NAME, status: "extended_coverage_inventory" })),
      islandAreas: [
        { geoid: "60", postalCode: "AS", name: "American Samoa", status: "extended_coverage_not_in_2025_national_gazetteer" },
        { geoid: "66", postalCode: "GU", name: "Guam", status: "extended_coverage_not_in_2025_national_gazetteer" },
        { geoid: "69", postalCode: "MP", name: "Commonwealth of the Northern Mariana Islands", status: "extended_coverage_not_in_2025_national_gazetteer" },
        { geoid: "78", postalCode: "VI", name: "U.S. Virgin Islands", status: "extended_coverage_not_in_2025_national_gazetteer" },
      ],
    },
    geographies,
    relationships,
  };
}

export function validateNationalGeographyCatalog(catalog: NationalGeographyCatalog) {
  const primaryCounties = catalog.geographies.filter((record) =>
    record.kind === "county" && record.releaseScope === "primary_50_states_dc");
  const duplicateCountyGeoids = [...new Set(primaryCounties
    .map((record) => record.geoid)
    .filter((geoid, index, all) => all.indexOf(geoid) !== index))];
  const invalidCountyGeoids = primaryCounties
    .filter((record) => !/^\d{5}$/.test(record.geoid))
    .map((record) => record.geoid);
  const stateGeoids = new Set(catalog.geographies.filter((record) => record.kind === "state").map((record) => record.geoid));
  const orphanCounties = primaryCounties
    .filter((record) => !record.stateFips || !stateGeoids.has(record.stateFips))
    .map((record) => record.geoid);
  const zctaOverlaps = catalog.relationships.filter((relationship) =>
    relationship.fromKind === "zcta" && relationship.toKind === "county");
  const crossCountyZctas = [...new Set(zctaOverlaps
    .map((relationship) => relationship.fromGeoid)
    .filter((geoid, _index, all) => all.filter((item) => item === geoid).length > 1))];
  const missingGeometryMetadata = primaryCounties
    .filter((record) => record.internalPoint === null || record.landAreaSquareMeters === null)
    .map((record) => record.geoid);
  return {
    valid: duplicateCountyGeoids.length === 0
      && invalidCountyGeoids.length === 0
      && orphanCounties.length === 0
      && missingGeometryMetadata.length === 0,
    authoritativePrimaryCountyCount: primaryCounties.length,
    searchablePrimaryCountyCount: primaryCounties.filter((record) =>
      record.geoid.length > 0 && record.name.length > 0 && record.displayName.length > 0).length,
    duplicateCountyGeoids,
    invalidCountyGeoids,
    orphanCounties,
    missingGeometryMetadata,
    crossCountyZctaCount: crossCountyZctas.length,
    counts: {
      statesAndDc: catalog.jurisdictions.primary.length,
      extendedJurisdictions: catalog.jurisdictions.extended.length + catalog.jurisdictions.islandAreas.length,
      countiesAndEquivalents: primaryCounties.length,
      censusPlaces: catalog.geographies.filter((record) => record.kind === "census_place" && record.releaseScope === "primary_50_states_dc").length,
      zctas: catalog.geographies.filter((record) => record.kind === "zcta" && record.releaseScope === "primary_50_states_dc").length,
      relationships: catalog.relationships.length,
    },
  };
}
