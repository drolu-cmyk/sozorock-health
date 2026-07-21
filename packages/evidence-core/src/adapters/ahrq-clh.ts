import type { SourceAdapter } from "./types.ts";

export type AhrqClhReleaseInput = {
  releaseLabel: string;
  reviewedDownloadUrls: string[];
};

export const ahrqClhAdapter: SourceAdapter<AhrqClhReleaseInput> = {
  id: "ahrq-clh-v1",
  family: "ahrq_clh",
  sourceId: "ahrq-clh",
  buildReleasePlan(input) {
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      releaseLabel: input.releaseLabel,
      requests: input.reviewedDownloadUrls.map((url) => ({
        url,
        method: "GET" as const,
        purpose: "Ingest an approved AHRQ Community-Level Health release artifact.",
        expectedMediaTypes: ["application/zip", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"],
      })),
      requiresHumanReview: true,
      notes: [
        "Variable-specific years and geography grain are preserved.",
        "A new CLH database version cannot be joined to a predecessor version until compatibility is reviewed.",
      ],
    };
  },
};
