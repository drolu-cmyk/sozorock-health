import type { SourceAdapter } from "./types.ts";

export type CdcPlacesReleaseInput = {
  releaseLabel: string;
  reviewedDatasetUrls: string[];
};

export const cdcPlacesAdapter: SourceAdapter<CdcPlacesReleaseInput> = {
  id: "cdc-places-v1",
  family: "cdc_places",
  sourceId: "cdc-places",
  buildReleasePlan(input) {
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      releaseLabel: input.releaseLabel,
      requests: input.reviewedDatasetUrls.map((url) => ({
        url,
        method: "GET" as const,
        purpose: "Ingest an approved PLACES release for a declared geography and measure contract.",
        expectedMediaTypes: ["application/json", "text/csv"],
      })),
      requiresHumanReview: true,
      notes: [
        "Measure definitions, universes, release dates, source periods, adjustment, and confidence intervals are versioned before values are accepted.",
        "Modeled estimates remain distinct from local planning priorities and cannot be used for overall place ranking.",
      ],
    };
  },
};
