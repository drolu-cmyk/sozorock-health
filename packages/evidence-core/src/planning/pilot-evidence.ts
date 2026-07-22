import { createHash } from "node:crypto";
import type {
  EvidenceCitation,
  EvidenceClaim,
  PlanningDocument,
  PlanningDocumentCandidate,
  SourceVersion,
} from "../contracts.ts";
import { buildPlanningReviewBundle, type DocumentPage, type ExtractionProposal, type PlanningReviewBundle } from "./workflow.ts";

const GENERATED_AT = "2026-07-21T23:45:00Z";

export const PILOT_GEOGRAPHIES = {
  albany: "county:36001",
  schenectady: "county:36093",
  montgomery: "county:36057",
  chester: "county:42029",
  bexar: "county:48029",
  capitalRegion: "planning-region:capital-region-ny",
  fultonMontgomeryServiceArea: "planning-region:st-marys-fulton-montgomery",
} as const;

function quotedTextHash(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sourceVersion({
  id,
  title,
  releaseDate,
  url,
  hash,
}: {
  id: string;
  title: string;
  releaseDate: string;
  url: string;
  hash: string;
}): SourceVersion {
  return {
    id,
    sourceId: "local-planning-documents",
    releaseLabel: title,
    releaseDate,
    dataPeriodStart: null,
    dataPeriodEnd: null,
    retrievedAt: GENERATED_AT,
    staleAfter: "2027-07-21T23:45:00Z",
    officialUrl: url,
    contentHash: hash,
    schemaVersion: "planning-document-artifact.v1",
    reviewStatus: "provisional",
    reviewedBy: null,
    reviewedAt: null,
  };
}

function documentFor(candidate: PlanningDocumentCandidate, version: SourceVersion, pageCount: number): PlanningDocument {
  return {
    id: `document:${candidate.id}`,
    sourceVersionId: version.id,
    documentType: candidate.documentType,
    title: candidate.title,
    publisher: candidate.publisher,
    officialUrl: candidate.artifactUrl,
    publishedAt: candidate.publicationDate,
    periodStart: candidate.planCycleStart,
    periodEnd: candidate.planCycleEnd,
    geographyIds: candidate.coveredGeographyIds,
    contentHash: version.contentHash,
    pageCount,
    coverageScope: candidate.coverageScope,
    currentPlanStatus: candidate.coverageScope === "hospital_specific" ? "not_applicable" : "not_yet_verified",
    reviewStatus: "provisional",
    reviewedBy: null,
    reviewedAt: null,
  };
}

function proposal({
  id,
  document,
  geographyIds,
  claimType,
  statement,
  quote,
  pageNumber,
  artifactPageIndex,
  section,
}: {
  id: string;
  document: PlanningDocument;
  geographyIds: string[];
  claimType: EvidenceClaim["claimType"];
  statement: string;
  quote: string;
  pageNumber: number | null;
  artifactPageIndex: number | null;
  section: string;
}): { page: DocumentPage; proposal: ExtractionProposal } {
  const claim: EvidenceClaim = {
    id: `claim:${id}`,
    documentId: document.id,
    geographyIds,
    claimType,
    statement,
    exactExcerpt: quote,
    extractionMethod: "structured_parser",
    confidence: "high",
    reviewStatus: "provisional",
    reviewedBy: null,
    reviewedAt: null,
  };
  const citation: EvidenceCitation = {
    id: `citation:${id}`,
    claimId: claim.id,
    documentId: document.id,
    sourceVersionId: document.sourceVersionId,
    pageNumber,
    artifactPageIndex,
    section,
    paragraph: null,
    sourceField: pageNumber === null ? "html_section" : null,
    quotedText: quote,
    quotedTextHash: quotedTextHash(quote),
    locatorBoundingBox: null,
    reviewStatus: "provisional",
  };
  return {
    page: { pageNumber, section, text: quote },
    proposal: { claim, citation, explicitStatement: true },
  };
}

function bundle({
  candidate,
  version,
  document,
  evidence,
}: {
  candidate: PlanningDocumentCandidate;
  version: SourceVersion;
  document: PlanningDocument;
  evidence: Array<{ page: DocumentPage; proposal: ExtractionProposal }>;
}) {
  return buildPlanningReviewBundle({
    generatedAt: GENERATED_AT,
    candidate,
    sourceVersion: version,
    document,
    pages: evidence.map((item) => item.page),
    proposals: evidence.map((item) => item.proposal),
  });
}

const capitalRegionArtifact = "https://www.healthycapitaldistrict.org/content/sites/hcdi/CHNA2025/CHNA_HCDI_2025.pdf";
const capitalRegionVersion = sourceVersion({
  id: "source-version:capital-region-chna-2025",
  title: "2025 Capital Region Community Health Needs Assessment",
  releaseDate: "2025-10-01",
  url: capitalRegionArtifact,
  hash: "sha256:01bb9394d210010b2c87fe188b3dbbb3885983b8bb2825bcec0b9a3b3b04796c",
});

const albanyCandidate: PlanningDocumentCandidate = {
  id: "candidate:albany-capital-region-chna-2025",
  sourceFamily: "regional_planning_collaborative",
  publisher: "Healthy Capital District",
  approvedHosts: ["albanycountyny.gov", "healthycapitaldistrict.org"],
  sourcePageUrl: "https://www.albanycountyny.gov/departments/health/data-statistics",
  artifactUrl: capitalRegionArtifact,
  documentType: "chna",
  title: "2025 Capital Region Community Health Needs Assessment",
  coveredGeographyIds: [PILOT_GEOGRAPHIES.capitalRegion],
  coverageScope: "regional",
  publicationDate: "2025-10-01",
  publicationDatePrecision: "month",
  planCycleStart: null,
  planCycleEnd: null,
  retrievedAt: GENERATED_AT,
  candidateConfidence: "high",
  candidateConfidenceScore: 0.98,
  confidenceReasons: [
    "Albany County's official data page links the artifact as the 2025 Capital Region CHNA.",
    "The artifact identifies Healthy Capital District and six covered Capital Region counties.",
    "The exact publication day is not stated; October 2025 is retained at month precision.",
  ],
  reviewStatus: "provisional",
};
const albanyDocument = documentFor(albanyCandidate, capitalRegionVersion, 319);
const albanyEvidence = [
  proposal({
    id: "albany-cost-barrier",
    document: albanyDocument,
    geographyIds: [PILOT_GEOGRAPHIES.albany],
    claimType: "finding",
    statement: "The regional assessment identifies cost-related forgone medical care as Albany County's highest rate in the Capital Region for the cited period.",
    quote: "Albany County had the highest rate in the Capital Region of adults who did not receive medical care due to cost in 2021, although the rate ranked in the top half of NYS counties and was lower than NYS, excluding NYC rate (BRFSS)",
    pageNumber: 17,
    artifactPageIndex: 18,
    section: "Albany County - General Health Status",
  }),
  proposal({
    id: "albany-diabetes-disparity",
    document: albanyDocument,
    geographyIds: [PILOT_GEOGRAPHIES.albany],
    claimType: "disparity",
    statement: "The assessment reports a large racial disparity in diabetes hospitalizations in Albany County.",
    quote: "Albany County’s 2020-2022 rate of diabetes hospitalizations was 3.9 times higher among Black non-Hispanic residents than White non-Hispanic residents (NYS CHIRE)",
    pageNumber: 17,
    artifactPageIndex: 18,
    section: "Albany County - Chronic Disease",
  }),
];

const schenectadyCandidate: PlanningDocumentCandidate = {
  ...albanyCandidate,
  id: "candidate:schenectady-capital-region-chna-2025",
  sourcePageUrl: "https://www.healthycapitaldistrict.org/tiles/index/display?alias=hcdireports",
};
const schenectadyDocument = documentFor(schenectadyCandidate, capitalRegionVersion, 319);
const schenectadyEvidence = [
  proposal({
    id: "schenectady-social-vulnerability",
    document: schenectadyDocument,
    geographyIds: [PILOT_GEOGRAPHIES.schenectady],
    claimType: "finding",
    statement: "The assessment identifies Schenectady County as having the Capital Region's highest overall Social Vulnerability Index.",
    quote: "Schenectady County had the highest overall Social Vulnerability Index (SVI) in the Capital Region (CDC)",
    pageNumber: 25,
    artifactPageIndex: 26,
    section: "Schenectady County - Sociodemographic",
  }),
  proposal({
    id: "schenectady-prenatal-disparity",
    document: schenectadyDocument,
    geographyIds: [PILOT_GEOGRAPHIES.schenectady],
    claimType: "disparity",
    statement: "The assessment reports the region's largest Hispanic-to-White disparity in early prenatal care in Schenectady County.",
    quote: "Schenectady County had the largest disparity in the Capital Region for percent of births with early prenatal care in 2020-2022, between Hispanic and White non-Hispanic residents (NYS Vital Statistics)",
    pageNumber: 26,
    artifactPageIndex: 27,
    section: "Schenectady County - Infant and Maternal Health",
  }),
];

const montgomeryArtifact = "https://www.smha.org/wp-content/uploads/2025/05/2024-PRC-CHNA-Report-St-Marys-Healthcare-Amsterdam_compressed-2.pdf";
const montgomeryCandidate: PlanningDocumentCandidate = {
  id: "candidate:st-marys-chna-2024",
  sourceFamily: "hospital_chna_csp_page",
  publisher: "St. Mary's Healthcare",
  approvedHosts: ["smha.org"],
  sourcePageUrl: "https://www.smha.org/aboutus/continuous-improvement/",
  artifactUrl: montgomeryArtifact,
  documentType: "chna",
  title: "2024 St. Mary's Healthcare Community Health Needs Assessment",
  coveredGeographyIds: [PILOT_GEOGRAPHIES.fultonMontgomeryServiceArea],
  coverageScope: "hospital_specific",
  publicationDate: "2024-08-01",
  publicationDatePrecision: "month",
  planCycleStart: null,
  planCycleEnd: null,
  retrievedAt: GENERATED_AT,
  candidateConfidence: "high",
  candidateConfidenceScore: 0.96,
  confidenceReasons: [
    "The hospital's official continuous-improvement page links the artifact.",
    "The assessment explicitly covers the St. Mary's service area spanning Fulton and Montgomery Counties.",
    "It is hospital-specific evidence and is not designated as Montgomery County's current plan.",
  ],
  reviewStatus: "provisional",
};
const montgomeryVersion = sourceVersion({
  id: "source-version:st-marys-chna-2024",
  title: montgomeryCandidate.title,
  releaseDate: "2024-08-01",
  url: montgomeryArtifact,
  hash: "sha256:5449348fa9d46a97cba3d9cc6400c9a18df83ccca946b29380e19fbb55e88d34",
});
const montgomeryDocument = documentFor(montgomeryCandidate, montgomeryVersion, 183);
const montgomeryEvidence = [
  proposal({
    id: "montgomery-service-area-priorities",
    document: montgomeryDocument,
    geographyIds: [PILOT_GEOGRAPHIES.fultonMontgomeryServiceArea],
    claimType: "priority",
    statement: "Community leaders ranked mental health, substance use, and nutrition, physical activity and weight as the service area's top three needs.",
    quote: "1. Mental Health 2. Substance Use 3. Nutrition, Physical Activity & Weight",
    pageNumber: 15,
    artifactPageIndex: 15,
    section: "Community Feedback on Prioritization of Health Needs",
  }),
  proposal({
    id: "montgomery-cross-cutting-housing",
    document: montgomeryDocument,
    geographyIds: [PILOT_GEOGRAPHIES.fultonMontgomeryServiceArea],
    claimType: "barrier",
    statement: "The assessment explicitly identifies social determinants, including housing, as a cross-cutting concern.",
    quote: "It is also important to note that the Social Determinants of Health (including Housing) are a cross-cutting issue that impact all of the above and also ranked highly among key informants' concerns.",
    pageNumber: 15,
    artifactPageIndex: 15,
    section: "Community Feedback on Prioritization of Health Needs",
  }),
];

const chesterArtifact = "https://www.chesco.org/DocumentCenter/View/79811/Chester-County-CHA--2025";
const chesterCandidate: PlanningDocumentCandidate = {
  id: "candidate:chester-county-cha-2025",
  sourceFamily: "county_local_health_department",
  publisher: "Chester County Health Department",
  approvedHosts: ["chesco.org"],
  sourcePageUrl: "https://www.chesco.org/5772/2025-Community-Health-Assessment",
  artifactUrl: chesterArtifact,
  documentType: "cha",
  title: "2025 Chester County Community Health Assessment",
  coveredGeographyIds: [PILOT_GEOGRAPHIES.chester],
  coverageScope: "county_specific",
  publicationDate: "2025-05-27",
  publicationDatePrecision: "day",
  planCycleStart: null,
  planCycleEnd: null,
  retrievedAt: GENERATED_AT,
  candidateConfidence: "high",
  candidateConfidenceScore: 0.99,
  confidenceReasons: [
    "The official county health department page links the assessment.",
    "The county release dates publication to May 27, 2025 and describes the forthcoming CHIP as a separate next step.",
  ],
  reviewStatus: "provisional",
};
const chesterVersion = sourceVersion({
  id: "source-version:chester-cha-2025",
  title: chesterCandidate.title,
  releaseDate: "2025-05-27",
  url: chesterArtifact,
  hash: "sha256:d8625e890c6caa05e4da765090f054b906ee31c39846ef57d2ca40daab22c2d4",
});
const chesterDocument = documentFor(chesterCandidate, chesterVersion, 121);
const chesterEvidence = [
  proposal({
    id: "chester-disparities",
    document: chesterDocument,
    geographyIds: [PILOT_GEOGRAPHIES.chester],
    claimType: "disparity",
    statement: "The county reports widening disparities in chronic disease outcomes and maternal and child health.",
    quote: "The assessment also highlighted demographic shifts and several key issues, including growing mental health concerns, the shortage of affordable housing and high cost of living, and persistent health and economic disparities, particularly among Black residents.",
    pageNumber: 11,
    artifactPageIndex: 10,
    section: "Key Findings",
  }),
  proposal({
    id: "chester-cost-housing-barrier",
    document: chesterDocument,
    geographyIds: [PILOT_GEOGRAPHIES.chester],
    claimType: "barrier",
    statement: "Community survey participants identified cost of living and affordable housing as major concerns.",
    quote: "Nearly 2 out of 3 (62%) survey respondents said “cost of living” and half (50%) of respondents said “lack of affordable, quality housing” were top community issues.",
    pageNumber: 13,
    artifactPageIndex: 12,
    section: "Housing Affordability and Cost of Living",
  }),
];

const bexarArtifact = "https://www.universityhealth.com/-/media/Files/About-Us/Community-Health-Needs-Assessment/Community-Health-Needs-Implementation-Strategy-2026.ashx";
const bexarCandidate: PlanningDocumentCandidate = {
  id: "candidate:university-health-bexar-implementation-2026",
  sourceFamily: "hospital_chna_csp_page",
  publisher: "University Health",
  approvedHosts: ["universityhealth.com"],
  sourcePageUrl: "https://www.universityhealth.com/about-us/community-health-needs-assessment",
  artifactUrl: bexarArtifact,
  documentType: "implementation_strategy",
  title: "University Health Community Health Needs Assessment and Implementation Strategy for Bexar County, 2026-2028",
  coveredGeographyIds: [PILOT_GEOGRAPHIES.bexar],
  coverageScope: "hospital_specific",
  publicationDate: "2026-03-01",
  publicationDatePrecision: "month",
  planCycleStart: "2026-01-01",
  planCycleEnd: "2028-12-31",
  retrievedAt: GENERATED_AT,
  candidateConfidence: "high",
  candidateConfidenceScore: 0.99,
  confidenceReasons: [
    "The official University Health page links the board-approved 2026-2028 implementation strategy.",
    "The artifact summarizes the 2025 Bexar County CHNA but remains University Health's hospital-specific strategy.",
  ],
  reviewStatus: "provisional",
};
const bexarVersion = sourceVersion({
  id: "source-version:university-health-bexar-implementation-2026",
  title: bexarCandidate.title,
  releaseDate: "2026-03-01",
  url: bexarArtifact,
  hash: "sha256:9926e1570fd26db6c60707a806def2e8207240d3105006a03f19fe020117b8e0",
});
const bexarDocument = documentFor(bexarCandidate, bexarVersion, 29);
const bexarEvidence = [
  proposal({
    id: "bexar-priority-categories",
    document: bexarDocument,
    geographyIds: [PILOT_GEOGRAPHIES.bexar],
    claimType: "priority",
    statement: "The 2025 Bexar CHNA organizes identified needs into three explicit priority categories.",
    quote: "The data are disaggregated to identify and describe health disparities and are grouped into three categories of priorities: • What We Need for Health • How We are Taking Care of Ourselves • How We are Faring",
    pageNumber: 2,
    artifactPageIndex: 1,
    section: "Executive Summary",
  }),
  proposal({
    id: "bexar-geographic-digital-barriers",
    document: bexarDocument,
    geographyIds: [PILOT_GEOGRAPHIES.bexar],
    claimType: "barrier",
    statement: "The assessment identifies rural, South Side, and West Side access disparities, including digital and transportation barriers.",
    quote: "For rural areas, in particular, there was discussion about digital equity and access",
    pageNumber: 8,
    artifactPageIndex: 7,
    section: "Geographic disparities",
  }),
  proposal({
    id: "bexar-access-objective",
    document: bexarDocument,
    geographyIds: [PILOT_GEOGRAPHIES.bexar],
    claimType: "objective",
    statement: "University Health's strategy explicitly aims to improve prevention, disease-management, and well-being access.",
    quote: "Improve access to care & services that promote prevention, disease management & overall well-being",
    pageNumber: 15,
    artifactPageIndex: 14,
    section: "How We are Taking Care of Ourselves",
  }),
  proposal({
    id: "bexar-sdoh-evaluation",
    document: bexarDocument,
    geographyIds: [PILOT_GEOGRAPHIES.bexar],
    claimType: "evaluation_measure",
    statement: "The strategy reports a concrete screening measure for adult inpatients.",
    quote: "In 2025, 76% of admitted adult patients were screened for SDOH.",
    pageNumber: 9,
    artifactPageIndex: 8,
    section: "Impact Evaluation",
  }),
];

export const PILOT_PLANNING_REVIEW_BUNDLES: PlanningReviewBundle[] = [
  bundle({ candidate: albanyCandidate, version: capitalRegionVersion, document: albanyDocument, evidence: albanyEvidence }),
  bundle({ candidate: schenectadyCandidate, version: capitalRegionVersion, document: schenectadyDocument, evidence: schenectadyEvidence }),
  bundle({ candidate: montgomeryCandidate, version: montgomeryVersion, document: montgomeryDocument, evidence: montgomeryEvidence }),
  bundle({ candidate: chesterCandidate, version: chesterVersion, document: chesterDocument, evidence: chesterEvidence }),
  bundle({ candidate: bexarCandidate, version: bexarVersion, document: bexarDocument, evidence: bexarEvidence }),
];

export const PILOT_PLANNING_CANDIDATES = PILOT_PLANNING_REVIEW_BUNDLES.map((bundleItem) => bundleItem.candidate);
