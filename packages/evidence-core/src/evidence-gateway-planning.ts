import type {
  CurrentPlanStatus,
  EvidenceCitation,
  EvidenceClaim,
  PlanningDocument,
  PlanningDocumentScope,
  ReviewStatus,
} from "./contracts.ts";

export const PLANNING_EVIDENCE_EXTENSION_VERSION = "sozorock.evidence-gateway.planning.v1" as const;

export type GatewayPlanningDocument = {
  id: string;
  source_version_id: string;
  document_type: PlanningDocument["documentType"];
  title: string;
  publisher: string;
  official_url: string;
  published_at: string | null;
  period_start: string | null;
  period_end: string | null;
  geography_ids: string[];
  content_hash: string;
  page_count: number | null;
  coverage_scope: PlanningDocumentScope;
  current_plan_status: CurrentPlanStatus;
  review_status: ReviewStatus;
  reviewed_by: string;
  reviewed_at: string;
};

export type GatewayPlanningClaim = {
  id: string;
  document_id: string;
  geography_ids: string[];
  claim_type: EvidenceClaim["claimType"];
  statement: string;
  extraction_method: EvidenceClaim["extractionMethod"];
  confidence: EvidenceClaim["confidence"];
  review_status: ReviewStatus;
  reviewed_by: string;
  reviewed_at: string;
};

export type GatewayPlanningCitation = {
  id: string;
  claim_id: string;
  document_id: string;
  source_version_id: string;
  page_number: number | null;
  artifact_page_index: number | null;
  section: string | null;
  source_field: string | null;
  quoted_text_hash: string;
  review_status: ReviewStatus;
};

export type PublicPlanningEvidenceExtensionV1 = {
  planning_contract_version: typeof PLANNING_EVIDENCE_EXTENSION_VERSION;
  planning_documents: GatewayPlanningDocument[];
  planning_claims: GatewayPlanningClaim[];
  planning_citations: GatewayPlanningCitation[];
};

type ReviewedSourceVersionRef = {
  id: string;
  reviewStatus: ReviewStatus;
};

type BuildPlanningEvidenceExtensionInput = {
  geographyId: string;
  sourceVersions: ReviewedSourceVersionRef[];
  planningDocuments?: PlanningDocument[];
  planningClaims?: EvidenceClaim[];
  planningCitations?: EvidenceCitation[];
};

function humanReviewed(value: { reviewStatus: ReviewStatus; reviewedBy?: string | null; reviewedAt?: string | null }) {
  return value.reviewStatus === "verified" && Boolean(value.reviewedBy?.trim() && value.reviewedAt?.trim());
}

function requiredLocator(citation: EvidenceCitation) {
  return (Number.isInteger(citation.pageNumber) && Number(citation.pageNumber) > 0)
    || Boolean(citation.section?.trim());
}

export function buildPlanningEvidenceExtensionV1(
  input: BuildPlanningEvidenceExtensionInput,
): PublicPlanningEvidenceExtensionV1 {
  if (!input.geographyId.trim()) throw new Error("Planning Evidence Gateway geographyId is required");

  const sourceVersionById = new Map(
    input.sourceVersions
      .filter((source) => source.reviewStatus === "verified")
      .map((source) => [source.id, source]),
  );

  const documents = (input.planningDocuments ?? []).filter((document) =>
    humanReviewed(document)
    && document.coverageScope === "county_specific"
    && document.geographyIds.length === 1
    && document.geographyIds[0] === input.geographyId
    && sourceVersionById.has(document.sourceVersionId),
  );
  const documentById = new Map(documents.map((document) => [document.id, document]));

  const candidateClaims = (input.planningClaims ?? []).filter((claim) =>
    humanReviewed(claim)
    && claim.geographyIds.length === 1
    && claim.geographyIds[0] === input.geographyId
    && documentById.has(claim.documentId),
  );
  const claimById = new Map(candidateClaims.map((claim) => [claim.id, claim]));

  const citations = (input.planningCitations ?? []).filter((citation) => {
    if (citation.reviewStatus !== "verified" || !requiredLocator(citation)) return false;
    const claim = claimById.get(citation.claimId);
    const document = documentById.get(citation.documentId);
    return Boolean(
      claim
      && document
      && claim.documentId === document.id
      && citation.documentId === document.id
      && citation.sourceVersionId === document.sourceVersionId
      && sourceVersionById.has(citation.sourceVersionId),
    );
  });
  const citedClaimIds = new Set(citations.map((citation) => citation.claimId));
  const claims = candidateClaims.filter((claim) => citedClaimIds.has(claim.id));
  const admittedClaimIds = new Set(claims.map((claim) => claim.id));
  const admittedCitations = citations.filter((citation) => admittedClaimIds.has(citation.claimId));
  const admittedDocumentIds = new Set(claims.map((claim) => claim.documentId));
  const admittedDocuments = documents.filter((document) => admittedDocumentIds.has(document.id));

  return {
    planning_contract_version: PLANNING_EVIDENCE_EXTENSION_VERSION,
    planning_documents: admittedDocuments.map((document) => ({
      id: document.id,
      source_version_id: document.sourceVersionId,
      document_type: document.documentType,
      title: document.title,
      publisher: document.publisher,
      official_url: document.officialUrl,
      published_at: document.publishedAt,
      period_start: document.periodStart,
      period_end: document.periodEnd,
      geography_ids: [...document.geographyIds],
      content_hash: document.contentHash,
      page_count: document.pageCount,
      coverage_scope: document.coverageScope,
      current_plan_status: document.currentPlanStatus,
      review_status: document.reviewStatus,
      reviewed_by: document.reviewedBy as string,
      reviewed_at: document.reviewedAt as string,
    })),
    planning_claims: claims.map((claim) => ({
      id: claim.id,
      document_id: claim.documentId,
      geography_ids: [...claim.geographyIds],
      claim_type: claim.claimType,
      statement: claim.statement,
      extraction_method: claim.extractionMethod,
      confidence: claim.confidence,
      review_status: claim.reviewStatus,
      reviewed_by: claim.reviewedBy as string,
      reviewed_at: claim.reviewedAt as string,
    })),
    planning_citations: admittedCitations.map((citation) => ({
      id: citation.id,
      claim_id: citation.claimId,
      document_id: citation.documentId,
      source_version_id: citation.sourceVersionId,
      page_number: citation.pageNumber,
      artifact_page_index: citation.artifactPageIndex ?? null,
      section: citation.section,
      source_field: citation.sourceField,
      quoted_text_hash: citation.quotedTextHash,
      review_status: citation.reviewStatus,
    })),
  };
}
