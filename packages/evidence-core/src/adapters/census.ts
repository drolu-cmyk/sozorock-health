import type { SourceAdapter } from "./types.ts";

export type CensusReleaseInput = {
  vintage: string;
  approvedArtifactUrls: string[];
};

export const censusGeographyAdapter: SourceAdapter<CensusReleaseInput> = {
  id: "census-geography-v1",
  family: "census_geography",
  sourceId: "census-geography",
  buildReleasePlan(input) {
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      releaseLabel: input.vintage,
      requests: input.approvedArtifactUrls.map((url) => ({
        url,
        method: "GET" as const,
        purpose: "Ingest reviewed Census geography, boundary, Gazetteer, or relationship artifact.",
        expectedMediaTypes: ["application/zip", "text/plain", "text/csv", "application/json"],
      })),
      requiresHumanReview: true,
      notes: [
        "Artifacts must come from census.gov or an approved Census subdomain.",
        "The release gate validates all state, county, place, ZCTA, and relationship identifiers before publication.",
        "No GitHub-maintained ZIP boundary repository is an accepted production input.",
      ],
    };
  },
};
