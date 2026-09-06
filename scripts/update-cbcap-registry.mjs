// Refresh only evidence represented by this county snapshot. Review dates and
// unrelated on-demand or planned sources retain their existing provenance.
export function updateCountyRegistry(registry, manifest) {
  const next = structuredClone(registry);
  const count = manifest.quality.actualCountyEquivalents;
  const matched = manifest.indicators.matchedCountyCount;
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(matched)
    || matched < 0 || matched > count || !Number.isFinite(Date.parse(manifest.generatedAt))) {
    throw new Error("Invalid county snapshot metadata");
  }
  const county = next.sources.find(({ id }) => id === "cdc-places-county-2025");
  const geography = next.sources.find(({ id }) => id === "census-tigerweb-current");
  if (!county || !geography) throw new Error("County snapshot registry entries are missing");
  for (const source of [county, geography]) {
    source.freshness.snapshotGeneratedAt = manifest.generatedAt;
    source.coverage.denominator = count;
  }
  county.coverage.numerator = matched;
  county.coverage.scope = `${matched.toLocaleString("en-US")} of ${count.toLocaleString("en-US")} current county equivalents have a matched CDC PLACES row in the committed release`;
  geography.coverage.numerator = count;
  geography.coverage.scope = `50 states, the District of Columbia, and ${count.toLocaleString("en-US")} current county equivalents in the committed release; supported subcounty geographies are queried from TIGERweb`;
  next.geographySearch.countyEquivalents.count = count;
  return next;
}
