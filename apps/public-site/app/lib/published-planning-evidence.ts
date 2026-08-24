import {
  buildPlanningEvidenceExtensionV1,
  type EvidenceCitation,
  type EvidenceClaim,
  type PlanningDocument,
  type PublicPlanningEvidenceExtensionV1,
  type ReviewStatus,
} from "@sozorock/evidence-core";
import {
  evidenceFieldValue,
  executeEvidenceSql,
} from "./evidence-runtime-authority";

type Row = unknown[];
type ReviewedSourceVersionRef = { id: string; reviewStatus: ReviewStatus };

function field(row: Row | undefined, index: number) {
  return evidenceFieldValue(row?.[index] as Parameters<typeof evidenceFieldValue>[0]);
}

function text(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getPublishedPlanningEvidenceExtension({
  geographyId,
  snapshotUuid,
  sourceVersions,
}: {
  geographyId: string;
  snapshotUuid: string;
  sourceVersions: ReviewedSourceVersionRef[];
}): Promise<PublicPlanningEvidenceExtensionV1> {
  const documentsResult = await executeEvidenceSql(
    `SELECT document.id::text, document.source_version_id::text, document.document_type,
            document.title, document.publisher, document.official_url,
            document.published_at::text, document.period_start::text, document.period_end::text,
            document.content_hash, document.page_count, document.coverage_scope,
            document.current_plan_status, document.review_status::text,
            document.reviewed_by, document.reviewed_at::text
       FROM evidence.planning_document document
       JOIN evidence.planning_document_geography geography_link
         ON geography_link.document_id=document.id
        AND geography_link.geography_id=CAST(:geography_id AS uuid)
        AND geography_link.relationship_kind='applies_to'
        AND geography_link.review_status='verified'
       JOIN evidence.snapshot_source_version snapshot_link
         ON snapshot_link.source_version_id=document.source_version_id
        AND snapshot_link.snapshot_id=CAST(:snapshot_id AS uuid)
      WHERE document.coverage_scope='county_specific'
        AND document.review_status='verified'
        AND document.reviewed_by IS NOT NULL
        AND document.reviewed_at IS NOT NULL
        AND (
          SELECT count(*)
            FROM evidence.planning_document_geography exact_scope
           WHERE exact_scope.document_id=document.id
             AND exact_scope.relationship_kind='applies_to'
             AND exact_scope.review_status='verified'
        )=1
      ORDER BY document.current_plan_status='verified_current' DESC,
               document.period_end DESC NULLS LAST,
               document.id`,
    [
      { name: "geography_id", value: { stringValue: geographyId } },
      { name: "snapshot_id", value: { stringValue: snapshotUuid } },
    ],
  );

  const planningDocuments: PlanningDocument[] = (documentsResult.records ?? []).map((row) => ({
    id: text(field(row, 0)),
    sourceVersionId: text(field(row, 1)),
    documentType: text(field(row, 2)) as PlanningDocument["documentType"],
    title: text(field(row, 3)),
    publisher: text(field(row, 4)),
    officialUrl: text(field(row, 5)),
    publishedAt: field(row, 6) === null ? null : text(field(row, 6)),
    periodStart: field(row, 7) === null ? null : text(field(row, 7)),
    periodEnd: field(row, 8) === null ? null : text(field(row, 8)),
    geographyIds: [geographyId],
    contentHash: text(field(row, 9)),
    pageCount: numberValue(field(row, 10)),
    coverageScope: text(field(row, 11)) as PlanningDocument["coverageScope"],
    currentPlanStatus: text(field(row, 12)) as PlanningDocument["currentPlanStatus"],
    reviewStatus: text(field(row, 13), "verified") as ReviewStatus,
    reviewedBy: text(field(row, 14)),
    reviewedAt: text(field(row, 15)),
  }));

  if (planningDocuments.length === 0) {
    return buildPlanningEvidenceExtensionV1({
      geographyId,
      sourceVersions,
      planningDocuments: [],
      planningClaims: [],
      planningCitations: [],
    });
  }

  const claimsResult = await executeEvidenceSql(
    `SELECT claim.id::text, claim.document_id::text, claim.claim_type,
            claim.statement, claim.exact_excerpt, claim.extraction_method,
            claim.confidence, claim.review_status::text, claim.reviewed_by,
            claim.reviewed_at::text
       FROM evidence.evidence_claim claim
       JOIN evidence.evidence_claim_geography geography_link
         ON geography_link.claim_id=claim.id
        AND geography_link.geography_id=CAST(:geography_id AS uuid)
       JOIN evidence.planning_document document ON document.id=claim.document_id
       JOIN evidence.planning_document_geography document_geography
         ON document_geography.document_id=document.id
        AND document_geography.geography_id=CAST(:geography_id AS uuid)
        AND document_geography.relationship_kind='applies_to'
        AND document_geography.review_status='verified'
       JOIN evidence.snapshot_source_version snapshot_link
         ON snapshot_link.source_version_id=document.source_version_id
        AND snapshot_link.snapshot_id=CAST(:snapshot_id AS uuid)
      WHERE claim.review_status='verified'
        AND claim.reviewed_by IS NOT NULL
        AND claim.reviewed_at IS NOT NULL
        AND document.coverage_scope='county_specific'
        AND document.review_status='verified'
        AND document.reviewed_by IS NOT NULL
        AND document.reviewed_at IS NOT NULL
        AND (
          SELECT count(*)
            FROM evidence.evidence_claim_geography exact_claim_scope
           WHERE exact_claim_scope.claim_id=claim.id
        )=1
        AND (
          SELECT count(*)
            FROM evidence.planning_document_geography exact_document_scope
           WHERE exact_document_scope.document_id=document.id
             AND exact_document_scope.relationship_kind='applies_to'
             AND exact_document_scope.review_status='verified'
        )=1
      ORDER BY claim.document_id, claim.claim_type, claim.id`,
    [
      { name: "geography_id", value: { stringValue: geographyId } },
      { name: "snapshot_id", value: { stringValue: snapshotUuid } },
    ],
  );

  const planningClaims: EvidenceClaim[] = (claimsResult.records ?? []).map((row) => ({
    id: text(field(row, 0)),
    documentId: text(field(row, 1)),
    geographyIds: [geographyId],
    claimType: text(field(row, 2)) as EvidenceClaim["claimType"],
    statement: text(field(row, 3)),
    exactExcerpt: text(field(row, 4)),
    extractionMethod: text(field(row, 5)) as EvidenceClaim["extractionMethod"],
    confidence: text(field(row, 6)) as EvidenceClaim["confidence"],
    reviewStatus: text(field(row, 7), "verified") as ReviewStatus,
    reviewedBy: text(field(row, 8)),
    reviewedAt: text(field(row, 9)),
  }));

  const citationsResult = await executeEvidenceSql(
    `SELECT citation.id::text, citation.claim_id::text, citation.document_id::text,
            citation.source_version_id::text, citation.page_number,
            citation.artifact_page_index, citation.section, citation.paragraph,
            citation.source_field, citation.quoted_text, citation.quoted_text_hash,
            citation.locator_bounding_box::text, citation.review_status::text
       FROM evidence.evidence_citation citation
       JOIN evidence.evidence_claim claim ON claim.id=citation.claim_id
       JOIN evidence.evidence_claim_geography claim_geography
         ON claim_geography.claim_id=claim.id
        AND claim_geography.geography_id=CAST(:geography_id AS uuid)
       JOIN evidence.planning_document document
         ON document.id=citation.document_id
        AND document.id=claim.document_id
        AND document.source_version_id=citation.source_version_id
       JOIN evidence.planning_document_geography document_geography
         ON document_geography.document_id=document.id
        AND document_geography.geography_id=CAST(:geography_id AS uuid)
        AND document_geography.relationship_kind='applies_to'
        AND document_geography.review_status='verified'
       JOIN evidence.snapshot_source_version snapshot_link
         ON snapshot_link.source_version_id=citation.source_version_id
        AND snapshot_link.snapshot_id=CAST(:snapshot_id AS uuid)
      WHERE citation.review_status='verified'
        AND claim.review_status='verified'
        AND claim.reviewed_by IS NOT NULL
        AND claim.reviewed_at IS NOT NULL
        AND document.review_status='verified'
        AND document.reviewed_by IS NOT NULL
        AND document.reviewed_at IS NOT NULL
        AND document.coverage_scope='county_specific'
        AND (citation.page_number IS NOT NULL OR nullif(btrim(citation.section), '') IS NOT NULL)
      ORDER BY citation.document_id, citation.claim_id, citation.page_number NULLS LAST, citation.id`,
    [
      { name: "geography_id", value: { stringValue: geographyId } },
      { name: "snapshot_id", value: { stringValue: snapshotUuid } },
    ],
  );

  const planningCitations: EvidenceCitation[] = (citationsResult.records ?? []).map((row) => ({
    id: text(field(row, 0)),
    claimId: text(field(row, 1)),
    documentId: text(field(row, 2)),
    sourceVersionId: text(field(row, 3)),
    pageNumber: numberValue(field(row, 4)),
    artifactPageIndex: numberValue(field(row, 5)),
    section: field(row, 6) === null ? null : text(field(row, 6)),
    paragraph: field(row, 7) === null ? null : text(field(row, 7)),
    sourceField: field(row, 8) === null ? null : text(field(row, 8)),
    quotedText: text(field(row, 9)),
    quotedTextHash: text(field(row, 10)),
    locatorBoundingBox: null,
    reviewStatus: text(field(row, 12), "verified") as ReviewStatus,
  }));

  return buildPlanningEvidenceExtensionV1({
    geographyId,
    sourceVersions,
    planningDocuments,
    planningClaims,
    planningCitations,
  });
}
