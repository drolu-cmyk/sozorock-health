import type { SourceAdapter } from "./types.ts";

export type AcsReleaseInput = {
  releaseLabel: string;
  reviewedApiUrls: string[];
};

export const acsAdapter: SourceAdapter<AcsReleaseInput> = {
  id: "census-acs5-v1",
  family: "acs",
  sourceId: "census-acs5",
  buildReleasePlan(input) {
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      releaseLabel: input.releaseLabel,
      requests: input.reviewedApiUrls.map((url) => ({
        url,
        method: "GET" as const,
        purpose: "Ingest approved ACS five-year estimate and margin-of-error variables.",
        expectedMediaTypes: ["application/json", "text/csv"],
      })),
      requiresHumanReview: true,
      notes: [
        "Every variable must have an approved universe, label, estimate field, margin-of-error field, and geography contract.",
        "Planning-region aggregation is blocked until a documented relationship and aggregation rule are approved.",
      ],
    };
  },
};
