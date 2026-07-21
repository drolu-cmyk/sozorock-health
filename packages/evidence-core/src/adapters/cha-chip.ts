import type { SourceAdapter } from "./types.ts";

export type PlanningDocumentInput = {
  releaseLabel: string;
  officialDocumentUrl: string;
  approvedPublisherHost: string;
};

export const planningDocumentAdapter: SourceAdapter<PlanningDocumentInput> = {
  id: "local-planning-document-v1",
  family: "local_planning_document",
  sourceId: "local-planning-documents",
  buildReleasePlan(input) {
    const hostname = new URL(input.officialDocumentUrl).hostname;
    if (hostname !== input.approvedPublisherHost && !hostname.endsWith(`.${input.approvedPublisherHost}`)) {
      throw new Error("Planning document URL does not match the reviewer-approved publisher host.");
    }
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      releaseLabel: input.releaseLabel,
      requests: [{
        url: input.officialDocumentUrl,
        method: "GET",
        purpose: "Retrieve one reviewer-approved local planning document for fingerprinting and extraction.",
        expectedMediaTypes: ["application/pdf", "text/html"],
      }],
      requiresHumanReview: true,
      notes: [
        "This adapter does not crawl the open web or discover arbitrary county documents.",
        "The document, publisher, geography, currentness, type, extracted claims, and citations remain provisional until human verification.",
      ],
    };
  },
};
