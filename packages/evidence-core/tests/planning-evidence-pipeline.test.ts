import assert from "node:assert/strict";
import test from "node:test";
import {
  PILOT_PLANNING_REVIEW_BUNDLES,
  applyHumanReviewDecision,
  buildPlanningReviewBundle,
  canPresentAsCurrentCountyPlan,
  discoverFromApprovedPlanningSources,
  validatePlanningCandidate,
  validateStructuredExtraction,
  type EvidenceCitation,
  type EvidenceClaim,
  type PlanningDocument,
  type PlanningDocumentCandidate,
  type PlanningReviewTask,
  type SourceVersion,
} from "../src/index.ts";

const HASH = `sha256:${"a".repeat(64)}`;
const NOW = "2026-07-21T20:00:00Z";

const candidate: PlanningDocumentCandidate = {
  id: "candidate:test",
  sourceFamily: "county_local_health_department",
  publisher: "Example County Health Department",
  approvedHosts: ["example.gov"],
  sourcePageUrl: "https://health.example.gov/planning",
  artifactUrl: "https://files.example.gov/plan.pdf",
  documentType: "chip",
  title: "Example County Community Health Improvement Plan",
  coveredGeographyIds: ["county:00001"],
  coverageScope: "county_specific",
  publicationDate: "2026-01-01",
  publicationDatePrecision: "day",
  planCycleStart: "2026-01-01",
  planCycleEnd: "2030-12-31",
  retrievedAt: NOW,
  candidateConfidence: "high",
  candidateConfidenceScore: 0.95,
  confidenceReasons: ["Official county source page."],
  reviewStatus: "provisional",
};

const source: SourceVersion = {
  id: "source:test",
  sourceId: "local-planning-documents",
  releaseLabel: candidate.title,
  releaseDate: "2026-01-01",
  dataPeriodStart: null,
  dataPeriodEnd: null,
  retrievedAt: NOW,
  staleAfter: "2027-01-01T00:00:00Z",
  officialUrl: candidate.artifactUrl,
  contentHash: HASH,
  schemaVersion: "planning-document-artifact.v1",
  reviewStatus: "provisional",
  reviewedBy: null,
  reviewedAt: null,
};

const document: PlanningDocument = {
  id: "document:test",
  sourceVersionId: source.id,
  documentType: "chip",
  title: candidate.title,
  publisher: candidate.publisher,
  officialUrl: candidate.artifactUrl,
  publishedAt: candidate.publicationDate,
  periodStart: candidate.planCycleStart,
  periodEnd: candidate.planCycleEnd,
  geographyIds: candidate.coveredGeographyIds,
  contentHash: HASH,
  pageCount: 20,
  coverageScope: "county_specific",
  currentPlanStatus: "not_yet_verified",
  reviewStatus: "provisional",
  reviewedBy: null,
  reviewedAt: null,
};

const quote = "The plan identifies transportation as a priority barrier.";
const claim: EvidenceClaim = {
  id: "claim:test",
  documentId: document.id,
  geographyIds: candidate.coveredGeographyIds,
  claimType: "priority",
  statement: quote,
  exactExcerpt: quote,
  extractionMethod: "structured_parser",
  confidence: "high",
  reviewStatus: "provisional",
  reviewedBy: null,
  reviewedAt: null,
};
const citation: EvidenceCitation = {
  id: "citation:test",
  claimId: claim.id,
  documentId: document.id,
  sourceVersionId: source.id,
  pageNumber: 4,
  artifactPageIndex: 3,
  section: "Priorities",
  paragraph: null,
  sourceField: null,
  quotedText: quote,
  quotedTextHash: HASH,
  locatorBoundingBox: null,
  reviewStatus: "provisional",
};

test("accepts only official reviewer-approved source hosts", () => {
  assert.equal(validatePlanningCandidate(candidate).valid, true);
  const invalid = validatePlanningCandidate({ ...candidate, artifactUrl: "https://example.com/plan.pdf" });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => /artifact/i.test(error)));
});

test("discovers candidates only through an approved official-source seed", () => {
  const accepted = discoverFromApprovedPlanningSources([{
    sourceFamily: candidate.sourceFamily,
    publisher: candidate.publisher,
    approvedHosts: candidate.approvedHosts,
    sourcePageUrl: candidate.sourcePageUrl,
    candidates: [candidate],
  }]);
  assert.equal(accepted.accepted.length, 1);
  assert.equal(accepted.rejected.length, 0);

  const mismatched = discoverFromApprovedPlanningSources([{
    sourceFamily: candidate.sourceFamily,
    publisher: "Different publisher",
    approvedHosts: candidate.approvedHosts,
    sourcePageUrl: candidate.sourcePageUrl,
    candidates: [candidate],
  }]);
  assert.equal(mismatched.accepted.length, 0);
  assert.ok(mismatched.rejected[0]?.errors.some((error) => /publisher/i.test(error)));
});

test("requires exact page or section citations and explicit statements for priority-like claims", () => {
  assert.equal(validateStructuredExtraction({ claim, citation, pageText: quote, explicitStatement: true }).valid, true);
  const inferred = validateStructuredExtraction({ claim, citation, pageText: quote, explicitStatement: false });
  assert.equal(inferred.valid, false);
  assert.ok(inferred.errors.some((error) => /explicit/i.test(error)));
  const mismatch = validateStructuredExtraction({ claim, citation, pageText: "Different page text.", explicitStatement: true });
  assert.equal(mismatch.valid, false);
  assert.ok(mismatch.errors.some((error) => /not found/i.test(error)));
  const missingArtifactPage = validateStructuredExtraction({
    claim,
    citation: { ...citation, artifactPageIndex: undefined },
    pageText: quote,
    explicitStatement: true,
  });
  assert.equal(missingArtifactPage.valid, false);
  assert.ok(missingArtifactPage.errors.some((error) => /artifact page index/i.test(error)));
});

test("supports exact HTML section citations without inventing a PDF page", () => {
  const htmlCitation: EvidenceCitation = {
    ...citation,
    pageNumber: null,
    artifactPageIndex: null,
    section: "Community priorities",
    sourceField: "html_section",
  };
  assert.equal(validateStructuredExtraction({
    claim,
    citation: htmlCitation,
    pageText: quote,
    explicitStatement: true,
  }).valid, true);
});

test("requires explicit source language for every action-bearing extraction type", () => {
  const explicitOnlyTypes: EvidenceClaim["claimType"][] = [
    "priority",
    "objective",
    "intervention",
    "responsible_partner",
    "target_population",
    "evaluation_measure",
  ];
  for (const claimType of explicitOnlyTypes) {
    const typedClaim = { ...claim, claimType };
    const result = validateStructuredExtraction({
      claim: typedClaim,
      citation,
      pageText: quote,
      explicitStatement: false,
    });
    assert.equal(result.valid, false, `${claimType} should require an explicit source statement`);
    assert.ok(result.errors.some((error) => /explicit/i.test(error)));
  }
});

test("routes ambiguous or low-confidence extraction to the internal review queue", () => {
  const bundle = buildPlanningReviewBundle({
    generatedAt: NOW,
    candidate,
    sourceVersion: source,
    document,
    pages: [{ pageNumber: 4, section: "Priorities", text: "Different page text." }],
    proposals: [{ claim: { ...claim, confidence: "low" }, citation, explicitStatement: true }],
  });
  assert.equal(bundle.acceptedClaims.length, 0);
  assert.equal(bundle.quarantinedClaims.length, 1);
  assert.ok(bundle.reviewTasks.some((task) => task.reason === "extraction_confidence_low"));
  assert.ok(bundle.reviewTasks.some((task) => task.reason === "current_plan_not_verified" && task.severity === "blocking"));
  assert.equal(bundle.publicEligibility, false);
});

test("never presents an unverified, regional, or hospital document as a county's current plan", () => {
  assert.equal(canPresentAsCurrentCountyPlan({ document, sourceStatus: source.reviewStatus, openTasks: [] }), false);
  const formallyVerified: PlanningDocument = {
    ...document,
    reviewStatus: "verified",
    currentPlanStatus: "verified_current",
    reviewedBy: "reviewer@sozorockfoundation.org",
    reviewedAt: NOW,
  };
  const openTask: PlanningReviewTask = {
    id: "task:block",
    candidateId: candidate.id,
    documentId: document.id,
    claimId: null,
    reason: "current_plan_not_verified",
    status: "open",
    severity: "blocking",
    summary: "Currentness requires review.",
    createdAt: NOW,
    assignedTo: null,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
  };
  assert.equal(canPresentAsCurrentCountyPlan({ document: formallyVerified, sourceStatus: "verified", openTasks: [openTask] }), false);
  assert.equal(canPresentAsCurrentCountyPlan({ document: formallyVerified, sourceStatus: "verified", openTasks: [] }), true);
  assert.equal(canPresentAsCurrentCountyPlan({ document: { ...formallyVerified, coverageScope: "regional" }, sourceStatus: "verified", openTasks: [] }), false);
});

test("requires an attributable human decision before closing a review task", () => {
  const task = buildPlanningReviewBundle({
    generatedAt: NOW,
    candidate,
    sourceVersion: source,
    document,
    pages: [],
    proposals: [],
  }).reviewTasks[0];
  assert.ok(task);
  assert.throws(() => applyHumanReviewDecision({ task, decision: "approved", reviewer: "", decidedAt: NOW, note: "" }));
  const decided = applyHumanReviewDecision({
    task,
    decision: "approved",
    reviewer: "reviewer@sozorockfoundation.org",
    decidedAt: NOW,
    note: "Official source, scope, and currentness confirmed.",
  });
  assert.equal(decided.status, "approved");
  assert.equal(decided.decidedBy, "reviewer@sozorockfoundation.org");
});

test("builds five non-public pilot review bundles with Albany evidence from the 2025 regional CHNA", () => {
  assert.equal(PILOT_PLANNING_REVIEW_BUNDLES.length, 5);
  assert.ok(PILOT_PLANNING_REVIEW_BUNDLES.every((bundle) => bundle.publicEligibility === false));
  assert.ok(PILOT_PLANNING_REVIEW_BUNDLES.every((bundle) => bundle.acceptedClaims.length > 0));
  assert.ok(PILOT_PLANNING_REVIEW_BUNDLES.every((bundle) => bundle.quarantinedClaims.length === 0));
  const albany = PILOT_PLANNING_REVIEW_BUNDLES.find((bundle) => bundle.candidate.id.includes("albany"));
  assert.ok(albany);
  assert.equal(albany.candidate.coverageScope, "regional");
  assert.ok(albany.acceptedClaims.some((item) => item.exactExcerpt.includes("3.9 times higher")));
  assert.ok(!albany.acceptedClaims.some((item) => item.claimType === "priority"));
});
