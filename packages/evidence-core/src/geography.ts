import type {
  Geography,
  GeographyAlias,
  GeographyRelationship,
  PlaceQuery,
  PlaceResolution,
} from "./contracts.ts";

export const UNITED_STATES_STATE_FIPS = new Set([
  "01", "02", "04", "05", "06", "08", "09", "10", "11", "12", "13",
  "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25",
  "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36",
  "37", "38", "39", "40", "41", "42", "44", "45", "46", "47", "48",
  "49", "50", "51", "53", "54", "55", "56",
]);

export type GeographyCatalog = {
  geographies: Geography[];
  aliases: GeographyAlias[];
  relationships: GeographyRelationship[];
};

function normalized(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function parseCountyFips(value: string) {
  const fips = value.trim();
  if (!/^\d{5}$/.test(fips)) return null;
  const stateFips = fips.slice(0, 2);
  const countyCode = fips.slice(2);
  if (!UNITED_STATES_STATE_FIPS.has(stateFips) || countyCode === "000") return null;
  return { fips, stateFips, countyCode };
}

export function isValidStateFips(value: string) {
  return UNITED_STATES_STATE_FIPS.has(value);
}

export function validateGeographyCatalog(catalog: GeographyCatalog) {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const geography of catalog.geographies) {
    if (ids.has(geography.id)) errors.push(`Duplicate geography id: ${geography.id}.`);
    ids.add(geography.id);
    if (geography.kind === "state" && !isValidStateFips(geography.authorityId)) {
      errors.push(`State ${geography.id} has an invalid Census state FIPS.`);
    }
    if (geography.kind === "county") {
      const parsed = parseCountyFips(geography.authorityId);
      if (!parsed || parsed.stateFips !== geography.stateFips || geography.countyFips !== geography.authorityId) {
        errors.push(`County ${geography.id} has an invalid or inconsistent county FIPS mapping.`);
      }
    }
    if (geography.kind === "zcta" && !/^\d{5}$/.test(geography.authorityId)) {
      errors.push(`ZCTA ${geography.id} must have a five-digit Census identifier.`);
    }
  }

  const relationshipKeys = new Set<string>();
  const overlapAreaByFrom = new Map<string, number>();
  for (const relationship of catalog.relationships) {
    if (!ids.has(relationship.fromGeographyId) || !ids.has(relationship.toGeographyId)) {
      errors.push(`Relationship ${relationship.id} references a missing geography.`);
    }
    const key = `${relationship.fromGeographyId}:${relationship.toGeographyId}:${relationship.kind}:${relationship.sourceVersionId}`;
    if (relationshipKeys.has(key)) errors.push(`Duplicate geography relationship: ${key}.`);
    relationshipKeys.add(key);
    for (const [label, value] of [
      ["area", relationship.overlapAreaPercent],
      ["population", relationship.overlapPopulationPercent],
    ] as const) {
      if (value !== null && (value < 0 || value > 100)) errors.push(`Relationship ${relationship.id} has an invalid ${label} overlap percentage.`);
    }
    if (relationship.kind === "overlaps" && relationship.overlapAreaPercent !== null) {
      overlapAreaByFrom.set(
        relationship.fromGeographyId,
        (overlapAreaByFrom.get(relationship.fromGeographyId) ?? 0) + relationship.overlapAreaPercent,
      );
    }
  }
  for (const [geographyId, total] of overlapAreaByFrom) {
    if (total > 100.01) errors.push(`Overlap area percentages for ${geographyId} exceed 100 percent.`);
  }

  return { valid: errors.length === 0, errors };
}

export function geographyCaveats(
  geography: Geography,
  relationships: GeographyRelationship[],
  geographies: Geography[],
) {
  const caveats = geography.caveat ? [geography.caveat] : [];
  if (geography.kind === "zcta") {
    caveats.unshift(
      "This is a Census ZIP Code Tabulation Area (ZCTA), a statistical approximation of ZIP-linked addresses, not a USPS delivery route.",
    );
    const countyRelationships = relationships.filter((relationship) => (
      relationship.fromGeographyId === geography.id
      && relationship.kind === "overlaps"
      && geographies.find((candidate) => candidate.id === relationship.toGeographyId)?.kind === "county"
    ));
    if (countyRelationships.length > 1) {
      const counties = countyRelationships
        .map((relationship) => geographies.find((candidate) => candidate.id === relationship.toGeographyId)?.displayName)
        .filter((value): value is string => Boolean(value));
      caveats.push(`This ZCTA overlaps ${counties.length} counties: ${counties.join(", ")}. County planning evidence must be shown separately.`);
    }
  }
  if (geography.kind === "census_place") {
    caveats.push("A Census place may differ from a postal city, local service area, or planning region and may cross county boundaries.");
  }
  if (geography.kind === "planning_region") {
    caveats.push("This planning region follows the membership and effective dates published by its governing source; it is not interchangeable with a county.");
  }
  return [...new Set(caveats)];
}

function candidateNames(geography: Geography, aliases: GeographyAlias[]) {
  return [
    geography.name,
    geography.displayName,
    ...aliases.filter((alias) => alias.geographyId === geography.id).map((alias) => alias.alias),
  ].map(normalized);
}

function exactMatches(
  query: PlaceQuery,
  catalog: GeographyCatalog,
) {
  const raw = normalized(query.raw);
  const stateHint = query.stateHint ? normalized(query.stateHint) : null;
  return catalog.geographies.filter((geography) => {
    if (geography.reviewStatus === "rejected" || geography.reviewStatus === "unavailable") return false;
    if (stateHint && geography.stateFips && geography.stateFips !== stateHint
      && !candidateNames(geography, catalog.aliases).some((name) => name.endsWith(` ${stateHint}`))) return false;
    if (query.kind === "county_fips") return geography.kind === "county" && geography.authorityId === query.raw;
    if (query.kind === "zcta") return geography.kind === "zcta" && geography.authorityId === query.raw;
    if (query.kind === "state") {
      return geography.kind === "state"
        && (geography.authorityId === query.raw || candidateNames(geography, catalog.aliases).includes(raw));
    }
    if (query.kind === "planning_region") {
      return geography.kind === "planning_region" && candidateNames(geography, catalog.aliases).includes(raw);
    }
    return geography.kind === "census_place" && candidateNames(geography, catalog.aliases).includes(raw);
  });
}

function relationshipsFor(geographyId: string, catalog: GeographyCatalog) {
  return catalog.relationships.filter((relationship) => (
    relationship.fromGeographyId === geographyId || relationship.toGeographyId === geographyId
  ));
}

function resolved(
  query: PlaceQuery,
  selected: Geography,
  catalog: GeographyCatalog,
  evidenceGeography = selected,
): PlaceResolution {
  const relationships = relationshipsFor(selected.id, catalog);
  return {
    query,
    status: "resolved",
    selected,
    alternatives: [],
    evidenceGeography,
    relationships,
    caveats: geographyCaveats(selected, relationships, catalog.geographies),
  };
}

export function resolvePlace(query: PlaceQuery, catalog: GeographyCatalog): PlaceResolution {
  if (query.kind === "zip_input") {
    const input = query.raw.trim();
    if (!/^\d{5}$/.test(input)) {
      return { query, status: "unsupported", selected: null, alternatives: [], evidenceGeography: null, relationships: [], caveats: ["ZIP input must contain five digits."] };
    }
    const zctaMatches = catalog.geographies.filter((geography) => (
      geography.kind === "zcta"
      && geography.authorityId === input
      && geography.reviewStatus !== "rejected"
      && geography.reviewStatus !== "unavailable"
    ));
    if (zctaMatches.length === 1) {
      const result = resolved(query, zctaMatches[0], catalog);
      result.caveats.unshift(`ZIP input ${input} resolved to Census ZCTA ${input} for statistical evidence.`);
      return result;
    }
    const postal = catalog.geographies.find((geography) => (
      geography.kind === "postal_zip" && geography.authorityId === input && geography.reviewStatus === "verified"
    ));
    if (postal) {
      const relation = catalog.relationships.find((candidate) => (
        candidate.fromGeographyId === postal.id && candidate.kind === "approximates"
      ));
      const evidenceGeography = relation
        ? catalog.geographies.find((candidate) => candidate.id === relation.toGeographyId) ?? null
        : null;
      const result = resolved(query, postal, catalog, evidenceGeography ?? postal);
      result.evidenceGeography = evidenceGeography;
      if (!evidenceGeography) result.caveats.push("This verified USPS ZIP does not yet have a compatible ZCTA evidence geography.");
      return result;
    }
    return {
      query,
      status: "not_found",
      selected: null,
      alternatives: [],
      evidenceGeography: null,
      relationships: [],
      caveats: ["No current Census ZCTA was verified for this ZIP input. A valid USPS ZIP may not have a corresponding ZCTA."],
    };
  }

  if (query.kind === "county_fips" && !parseCountyFips(query.raw)) {
    return { query, status: "unsupported", selected: null, alternatives: [], evidenceGeography: null, relationships: [], caveats: ["County FIPS must be a valid five-digit state and county code."] };
  }

  const matches = exactMatches(query, catalog);
  if (matches.length === 1) return resolved(query, matches[0], catalog);
  if (matches.length > 1) {
    return {
      query,
      status: "ambiguous",
      selected: null,
      alternatives: matches,
      evidenceGeography: null,
      relationships: [],
      caveats: ["More than one official geography matches this name. Select the intended state and geography type before evidence is loaded."],
    };
  }
  return { query, status: "not_found", selected: null, alternatives: [], evidenceGeography: null, relationships: [], caveats: ["No reviewed official geography matched this query."] };
}
