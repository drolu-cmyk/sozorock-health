import type {
  EvidenceCitation,
  EvidenceClaim,
  PlanningDocument,
  PlanningDocumentCandidate,
  PlanningReviewReason,
  PlanningReviewTask,
  ReviewStatus,
} from "../contracts.ts";
import { PLANNING_SOURCE_FAMILIES } from "../contracts.ts";
import type { ValidationResult } from "../quality.ts";

const EXPLICIT_ONLY_CLAIM_TYPES = new Set<EvidenceClaim["claimType"]>([
  "priority",
  "objective",
  "intervention",
  "responsible_partner",
  "target_population",
  "evaluation_measure",
]);

function hostMatches(url: string, approvedHost: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const normalized = approvedHost.toLowerCase();
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  } catch {
    return false;
  }
}

function validDate(value: string | null) {
  return value === null || Number.isFinite(Date.parse(value));
}

export function validatePlanningCandidate(candidate: PlanningDocumentCandidate): ValidationResult {
  const errors: string[] = [];
  if (!PLANNING_SOURCE_FAMILIES.includes(candidate.sourceFamily)) {
    errors.push("Planning candidate source family is not approved.");
  }
  if (!candidate.publisher.trim()) errors.push("Planning candidate requires a publisher.");
  if (candidate.approvedHosts.length === 0) errors.push("Planning candidate requires at least one reviewer-approved publisher host.");
  if (!candidate.approvedHosts.some((host) => hostMatches(candidate.sourcePageUrl, host))) {
    errors.push("Planning candidate source page is not on the reviewer-approved publisher host.");
  }
  if (!candidate.approvedHosts.some((host) => hostMatches(candidate.artifactUrl, host))) {
    errors.push("Planning candidate artifact is not on the reviewer-approved publisher host.");
  }
  if (candidate.coveredGeographyIds.length === 0) errors.push("Planning candidate requires at least one covered geography.");
  if (!validDate(candidate.publicationDate)) errors.push("Planning candidate publication date is invalid.");
  if (!validDate(candidate.planCycleStart) || !validDate(candidate.planCycleEnd)) {
    errors.push("Planning candidate plan cycle dates are invalid.");
  }
  if (!validDate(candidate.retrievedAt)) errors.push("Planning candidate retrieval date is invalid.");
  if (candidate.candidateConfidenceScore < 0 || candidate.candidateConfidenceScore > 1) {
    errors.push("Planning candidate confidence score must be between zero and one.");
  }
  if (candidate.candidateConfidence === "high" && candidate.candidateConfidenceScore < 0.8) {
    errors.push("High-confidence planning candidates require a confidence score of at least 0.8.");
  }
  if (candidate.coverageScope === "county_specific" && candidate.coveredGeographyIds.length !== 1) {
    errors.push("A county-specific planning candidate must cover exactly one county geography.");
  }
  return { valid: errors.length === 0, errors };
}

export function validateStructuredExtraction({
  claim,
  citation,
  pageText,
  explicitStatement,
}: {
  claim: EvidenceClaim;
  citation: EvidenceCitation;
  pageText: string;
  explicitStatement: boolean;
}): ValidationResult {
  const errors: string[] = [];
  if (citation.claimId !== claim.id) errors.push("Citation does not belong to the extracted claim.");
  if (citation.pageNumber === null && !citation.section?.trim()) {
    errors.push("Extracted evidence requires an exact page or HTML section locator.");
  }
  if (citation.pageNumber !== null && citation.artifactPageIndex === undefined) {
    errors.push("PDF evidence requires the artifact page index in addition to the printed page number.");
  }
  if (!citation.quotedText.trim()) errors.push("Extracted evidence requires exact quoted text.");
  if (!claim.exactExcerpt.includes(citation.quotedText)) {
    errors.push("Citation text must be retained verbatim in the claim excerpt.");
  }
  const normalizedPage = pageText.replace(/\s+/g, " ").trim();
  const normalizedQuote = citation.quotedText.replace(/\s+/g, " ").trim();
  if (normalizedQuote && !normalizedPage.includes(normalizedQuote)) {
    errors.push("Citation text was not found on the cited page or section.");
  }
  if (EXPLICIT_ONLY_CLAIM_TYPES.has(claim.claimType) && !explicitStatement) {
    errors.push(`${claim.claimType} may be extracted only when the document states it explicitly.`);
  }
  return { valid: errors.length === 0, errors };
}

export function canPresentAsCurrentCountyPlan({
  document,
  sourceStatus,
  openTasks,
}: {
  document: PlanningDocument;
  sourceStatus: ReviewStatus;
  openTasks: PlanningReviewTask[];
}) {
  return document.documentType === "chip"
    && document.coverageScope === "county_specific"
    && document.currentPlanStatus === "verified_current"
    && document.reviewStatus === "verified"
    && sourceStatus === "verified"
    && Boolean(document.reviewedBy && document.reviewedAt)
    && !openTasks.some((task) => task.documentId === document.id && task.status === "open" && task.severity === "blocking");
}

export function reviewReasonsForCandidate(candidate: PlanningDocumentCandidate): PlanningReviewReason[] {
  const reasons: PlanningReviewReason[] = [];
  if (!validatePlanningCandidate(candidate).valid) reasons.push("candidate_source_not_approved");
  if (candidate.candidateConfidence !== "high") reasons.push("candidate_confidence_below_threshold");
  if (!candidate.publicationDate) reasons.push("publication_date_missing");
  if ((candidate.documentType === "chip" || candidate.documentType === "csp" || candidate.documentType === "implementation_strategy")
    && (!candidate.planCycleStart || !candidate.planCycleEnd)) reasons.push("plan_cycle_missing");
  return reasons;
}
