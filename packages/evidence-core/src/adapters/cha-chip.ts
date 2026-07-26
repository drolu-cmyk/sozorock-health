import type { SourceAdapter } from "./types.ts";
import type { PlanningDocumentCandidate } from "../contracts.ts";
import { validatePlanningCandidate } from "../planning/quality.ts";

export type PlanningDocumentInput = {
  candidate: PlanningDocumentCandidate;
};

export const planningDocumentAdapter: SourceAdapter<PlanningDocumentInput> = {
  id: "local-planning-document-v1",
  family: "local_planning_document",
  sourceId: "local-planning-documents",
  buildReleasePlan(input) {
    const validation = validatePlanningCandidate(input.candidate);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    return {
      adapterId: this.id,
      sourceId: this.sourceId,
      releaseLabel: input.candidate.title,
      requests: [{
        url: input.candidate.artifactUrl,
        method: "GET",
        purpose: "Retrieve one reviewer-approved local planning document for fingerprinting and extraction.",
        expectedMediaTypes: ["application/pdf", "text/html"],
      }],
      requiresHumanReview: true,
      notes: [
        "This adapter does not crawl the open web or discover arbitrary county documents.",
        "Candidate discovery is limited to approved official source families and reviewer-approved publisher hosts.",
        "The document, publisher, geography, currentness, type, extracted claims, and citations remain provisional until human verification.",
      ],
    };
  },
};
