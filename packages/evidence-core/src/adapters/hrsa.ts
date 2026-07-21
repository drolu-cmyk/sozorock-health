import type { SourceAdapter } from "./types.ts";

export type HrsaReleaseInput = {
  releaseLabel: string;
  reviewedDownloadUrls: string[];
  product: "hpsa" | "mua_p" | "ahrf";
};

export const hrsaAdapter: SourceAdapter<HrsaReleaseInput> = {
  id: "hrsa-workforce-v1",
  family: "hrsa",
  sourceId: "hrsa-workforce",
  buildReleasePlan(input) {
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      releaseLabel: `${input.product}:${input.releaseLabel}`,
      requests: input.reviewedDownloadUrls.map((url) => ({
        url,
        method: "GET" as const,
        purpose: `Ingest approved HRSA ${input.product} release with designation or variable-level dates.`,
        expectedMediaTypes: ["text/csv", "application/zip", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      })),
      requiresHumanReview: true,
      notes: [
        "Geographic, population-group, and facility designations remain separate.",
        "AHRF variable years are retained per observation and are not replaced by the file release year.",
      ],
    };
  },
};
