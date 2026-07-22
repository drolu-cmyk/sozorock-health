import type {
  EvidenceCitation,
  EvidenceClaim,
  PlanningDocument,
  PlanningDocumentCandidate,
  PlanningReviewReason,
  PlanningReviewTask,
  SourceVersion,
} from "../contracts.ts";
import { reviewReasonsForCandidate, validateStructuredExtraction } from "./quality.ts";

export type DocumentPage = {
  pageNumber: number | null;
  section: string | null;
  text: string;
};

export type ExtractionProposal = {
  claim: EvidenceClaim;
  citation: EvidenceCitation;
  explicitStatement: boolean;
};

export type PlanningReviewBundle = {
  schemaVersion: "planning-evidence-review.v1";
  generatedAt: string;
  candidate: PlanningDocumentCandidate;
  sourceVersion: SourceVersion | null;
  document: PlanningDocument | null;
  acceptedClaims: EvidenceClaim[];
  acceptedCitations: EvidenceCitation[];
  quarantinedClaims: EvidenceClaim[];
  reviewTasks: PlanningReviewTask[];
  publicEligibility: false;
};

function reviewTask({
  candidate,
  documentId,
  claimId,
  reason,
  summary,
  createdAt,
}: {
  candidate: PlanningDocumentCandidate;
  documentId: string | null;
  claimId: string | null;
  reason: PlanningReviewReason;
  summary: string;
  createdAt: string;
}): PlanningReviewTask {
  return {
    id: `review:${candidate.id}:${reason}:${claimId ?? documentId ?? "candidate"}`,
    candidateId: candidate.id,
    documentId,
    claimId,
    reason,
    status: "open",
    severity: reason === "current_plan_not_verified" || reason === "candidate_source_not_approved"
      ? "blocking"
      : "review_required",
    summary,
    createdAt,
    assignedTo: null,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
  };
}

export function buildPlanningReviewBundle({
  generatedAt,
  candidate,
  sourceVersion,
  document,
  pages,
  proposals,
}: {
  generatedAt: string;
  candidate: PlanningDocumentCandidate;
  sourceVersion: SourceVersion | null;
  document: PlanningDocument | null;
  pages: DocumentPage[];
  proposals: ExtractionProposal[];
}): PlanningReviewBundle {
  const acceptedClaims: EvidenceClaim[] = [];
  const acceptedCitations: EvidenceCitation[] = [];
  const quarantinedClaims: EvidenceClaim[] = [];
  const reviewTasks: PlanningReviewTask[] = reviewReasonsForCandidate(candidate).map((reason) => reviewTask({
    candidate,
    documentId: document?.id ?? null,
    claimId: null,
    reason,
    summary: `Candidate requires review: ${reason.replaceAll("_", " ")}.`,
    createdAt: generatedAt,
  }));

  if (!document || !sourceVersion) {
    reviewTasks.push(reviewTask({
      candidate,
      documentId: document?.id ?? null,
      claimId: null,
      reason: "current_plan_not_verified",
      summary: "The official artifact has not completed fingerprinting and document review.",
      createdAt: generatedAt,
    }));
  }

  for (const proposal of proposals) {
    const pageText = pages
      .filter((item) => item.pageNumber === proposal.citation.pageNumber
        && (proposal.citation.section === null || item.section === proposal.citation.section))
      .map((item) => item.text)
      .join("\n");
    const result = validateStructuredExtraction({
      ...proposal,
      pageText,
    });
    if (!result.valid || proposal.claim.confidence === "low") {
      quarantinedClaims.push(proposal.claim);
      const reason: PlanningReviewReason = proposal.claim.confidence === "low"
        ? "extraction_confidence_low"
        : result.errors.some((error) => /not found/i.test(error))
          ? "citation_text_mismatch"
          : result.errors.some((error) => /explicit/i.test(error))
            ? "claim_not_explicit"
            : "citation_locator_missing";
      reviewTasks.push(reviewTask({
        candidate,
        documentId: document?.id ?? null,
        claimId: proposal.claim.id,
        reason,
        summary: result.errors.join(" ") || "Low-confidence extraction requires human review.",
        createdAt: generatedAt,
      }));
      continue;
    }
    acceptedClaims.push(proposal.claim);
    acceptedCitations.push(proposal.citation);
    if (proposal.claim.reviewStatus !== "verified") {
      reviewTasks.push(reviewTask({
        candidate,
        documentId: document?.id ?? null,
        claimId: proposal.claim.id,
        reason: "formal_verification_required",
        summary: "The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use.",
        createdAt: generatedAt,
      }));
    }
  }

  const isCountyPlanCandidate = candidate.coverageScope === "county_specific"
    && (candidate.documentType === "chip" || candidate.documentType === "csp" || candidate.documentType === "implementation_strategy");
  if (isCountyPlanCandidate && (!document || document.currentPlanStatus !== "verified_current")) {
    reviewTasks.push(reviewTask({
      candidate,
      documentId: document?.id ?? null,
      claimId: null,
      reason: "current_plan_not_verified",
      summary: "This document must not be described as the geography's current plan until a human reviewer verifies that designation.",
      createdAt: generatedAt,
    }));
  }

  return {
    schemaVersion: "planning-evidence-review.v1",
    generatedAt,
    candidate,
    sourceVersion,
    document,
    acceptedClaims,
    acceptedCitations,
    quarantinedClaims,
    reviewTasks: [...new Map(reviewTasks.map((task) => [task.id, task])).values()],
    publicEligibility: false,
  };
}

export function applyHumanReviewDecision({
  task,
  decision,
  reviewer,
  decidedAt,
  note,
}: {
  task: PlanningReviewTask;
  decision: "approved" | "rejected";
  reviewer: string;
  decidedAt: string;
  note: string;
}): PlanningReviewTask {
  if (!reviewer.trim() || !note.trim() || !Number.isFinite(Date.parse(decidedAt))) {
    throw new Error("Review decisions require a named reviewer, ISO-compatible date, and decision note.");
  }
  return { ...task, status: decision, decidedBy: reviewer, decidedAt, decisionNote: note };
}
