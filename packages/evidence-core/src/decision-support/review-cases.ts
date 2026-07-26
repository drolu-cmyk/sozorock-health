import type { CaseForActionPackage, DecisionSupportSignal } from "./types.ts";
import { CASE_FOR_ACTION_SCHEMA_VERSION } from "./types.ts";
import { validateCaseForAction } from "./quality.ts";

const GENERATED_AT = "2026-07-22T18:00:00Z";
const RETRIEVED_AT = "2026-07-22T17:30:00Z";
const CDC_RELEASE_DATE = "2025-12-04";
const CDC_DATA_PERIOD = "BRFSS 2023 and 2022; ACS 2019–2023 and 2018–2022";
const COMPARISON_LABEL = "Average across U.S. county estimates in the same release";

function signal(input: Omit<DecisionSupportSignal, "unit" | "geographyLevel" | "sourceId" | "sourceVersionId" | "sourceRecordId" | "releaseDate" | "dataPeriod" | "retrievedAt" | "reviewStatus">): DecisionSupportSignal {
  return {
    ...input,
    unit: "percent",
    geographyLevel: "county",
    sourceId: "cdc-places-2025-county",
    sourceVersionId: "source-version:cdc-places-2025-county:2025-12-04",
    sourceRecordId: `countyfips=${input.geographyId.replace("county:", "")}; measure=${input.id}`,
    releaseDate: CDC_RELEASE_DATE,
    dataPeriod: CDC_DATA_PERIOD,
    retrievedAt: RETRIEVED_AT,
    reviewStatus: "verified",
  };
}

const sharedSources = [
  {
    id: "census-geography-2025",
    publisher: "U.S. Census Bureau",
    title: "2025 TIGER/Line county geography",
    officialUrl: "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
    releaseDate: "2025-12-31",
    dataPeriod: "2025 geography vintage",
    retrievedAt: RETRIEVED_AT,
    geography: "County",
    reviewStatus: "verified" as const,
    use: "geography" as const,
  },
  {
    id: "cdc-places-2025-county",
    publisher: "Centers for Disease Control and Prevention",
    title: "CDC PLACES: County Data (GIS Friendly Format), 2025 release",
    officialUrl: "https://data.cdc.gov/d/i46a-9kgh",
    releaseDate: CDC_RELEASE_DATE,
    dataPeriod: CDC_DATA_PERIOD,
    retrievedAt: RETRIEVED_AT,
    geography: "County; age-adjusted modeled estimates",
    reviewStatus: "verified" as const,
    use: "public_data" as const,
  },
];

const albany: CaseForActionPackage = {
  id: "case-for-action:county-36001:review-v1",
  schemaVersion: CASE_FOR_ACTION_SCHEMA_VERSION,
  releaseStatus: "review_only",
  generatedAt: GENERATED_AT,
  editable: true,
  place: {
    geographyId: "county:36001",
    kind: "county",
    fips: "36001",
    displayName: "Albany County, New York",
    state: "New York",
    population: 316659,
    geographyCaveat: "The evidence applies to Albany County as a whole. It must not be represented as specific to every ZIP Code, city, or neighborhood within the county.",
  },
  executiveSummary: "Current county-level public data is available, but a current county-specific CHA, CHIP, or CHNA has not completed verification in this system. The reviewed measures below do not establish a material access concern on their own. A regional assessment contains Albany-specific candidate findings, but those claims remain withheld from the public case until human review is complete.",
  evidenceStatus: { localPlan: "not_yet_verified", publicData: "verified", resourceCoverage: "no_verified_records" },
  localPlan: {
    publicStatement: "A 2025 regional assessment linked by Albany County has been cataloged. Because it covers the Capital Region and its Albany-specific claims remain provisional, it is not presented as Albany County’s current plan or as verified local-plan alignment.",
    verifiedAlignment: [],
    documents: [{
      id: "document:albany-capital-region-chna-2025",
      title: "2025 Capital Region Community Health Needs Assessment",
      publisher: "Healthy Capital District",
      officialUrl: "https://www.healthycapitaldistrict.org/content/sites/hcdi/CHNA2025/CHNA_HCDI_2025.pdf",
      publicationDate: "2025-10",
      planCycle: null,
      coverage: "regional",
      currentPlanStatus: "not_yet_verified",
      reviewStatus: "provisional",
    }],
  },
  publicData: {
    publicStatement: "The comparison below uses age-adjusted CDC PLACES modeled county estimates. It provides context, not diagnoses, local-plan priorities, or proof of need.",
    signals: [
      signal({ id: "albany-loneliness", label: "Adults reporting loneliness", definition: "Estimated share of adults who report feeling lonely.", category: "practical_barrier", localValue: 36.1, comparisonValue: 34.2, comparisonLabel: COMPARISON_LABEL, difference: 1.9, direction: "adverse", interpretation: "context_only", confidenceInterval: "31.8–40.7", geographyId: "county:36001" }),
      signal({ id: "albany-transportation", label: "Lack of reliable transportation", definition: "Estimated share of adults unable to reach needed destinations because transportation was unavailable.", category: "practical_barrier", localValue: 7.4, comparisonValue: 9.4, comparisonLabel: COMPARISON_LABEL, difference: -2.0, direction: "adverse", interpretation: "favorable_signal", confidenceInterval: "6.3–8.8", geographyId: "county:36001" }),
      signal({ id: "albany-uninsured", label: "Adults without health insurance", definition: "Estimated share of adults ages 18–64 without current health insurance.", category: "practical_barrier", localValue: 5.7, comparisonValue: 11.7, comparisonLabel: COMPARISON_LABEL, difference: -6.0, direction: "adverse", interpretation: "favorable_signal", confidenceInterval: "4.4–7.3", geographyId: "county:36001" }),
      signal({ id: "albany-colorectal-screening", label: "Colorectal cancer screening", definition: "Estimated share of adults ages 45–75 who are up to date with colorectal cancer screening.", category: "preventive_service", localValue: 65.1, comparisonValue: 57.5, comparisonLabel: COMPARISON_LABEL, difference: 7.6, direction: "protective", interpretation: "favorable_signal", confidenceInterval: "61.1–69.0", geographyId: "county:36001" }),
    ],
  },
  practicalBarriers: [],
  resourceCoverage: {
    publicStatement: "No SozoRock, community, or provider resource record has completed verification for display in this brief. This means coverage is unknown—not that resources do not exist.",
    resources: [],
  },
  responseConcept: {
    responseType: null,
    status: "insufficient evidence",
    title: "No SozoRock response selected yet",
    summary: "Complete local-plan and resource verification before proposing a Health Equity Hub, Health Access Day, provider-led pathway, or workforce conversation.",
    pathway: [
      { stage: "Evidence", statement: "Current county-level modeled estimates are verified.", status: "verified" },
      { stage: "Practical barrier", statement: "No material county-level practical barrier is verified in this review set.", status: "missing" },
      { stage: "Potential response", statement: "No response is selected until local evidence is verified.", status: "missing" },
      { stage: "Partner role", statement: "Local partners review planning evidence and identify existing services.", status: "proposed_for_partner_review" },
      { stage: "Measure of progress", statement: "Track evidence verification and partner/resource coverage before implementation.", status: "proposed_for_partner_review" },
    ],
  },
  progressMeasures: [
    { id: "albany-plan-review", label: "Planning evidence reviewed", definition: "Share of cataloged local-plan claims with a completed human decision and exact citation.", status: "proposed_for_partner_review" },
    { id: "albany-resource-coverage", label: "Verified resource coverage", definition: "Number and geographic coverage of active non-clinical resources verified with local partners.", status: "proposed_for_partner_review" },
  ],
  evidenceGaps: [
    "A verified current county-specific CHA, CHIP, CHNA, or implementation plan.",
    "Verified local resource, service-capacity, and partner coverage.",
    "Location-specific workforce evidence from an approved HRSA import.",
    "Local review of whether county averages obscure neighborhood or population disparities.",
  ],
  sources: [
    ...sharedSources,
    {
      id: "albany-capital-region-chna-2025",
      publisher: "Healthy Capital District",
      title: "2025 Capital Region Community Health Needs Assessment",
      officialUrl: "https://www.healthycapitaldistrict.org/content/sites/hcdi/CHNA2025/CHNA_HCDI_2025.pdf",
      releaseDate: "2025-10",
      dataPeriod: "Regional assessment; plan cycle not yet verified",
      retrievedAt: "2026-07-21T00:00:00Z",
      geography: "Capital Region; Albany-specific candidate findings",
      reviewStatus: "provisional",
      use: "local_plan",
    },
  ],
  disclosures: [
    "CDC PLACES values are modeled area estimates, not diagnoses, patient counts, or proof that a local response will cause an outcome.",
    "This review-only brief does not provide medical advice and does not authorize an intervention.",
    "Local partners must confirm priorities, existing work, feasibility, roles, and measures before action.",
  ],
  internalReview: {
    summary: "Two Albany-specific claims were extracted from a regional CHNA. Both remain provisional and are excluded from the public narrative until a reviewer confirms the document scope, wording, and exact page citations.",
    claimsAwaitingReview: [
      { id: "claim:albany-cost-barrier", documentId: "document:albany-capital-region-chna-2025", type: "finding", statement: "The regional assessment identifies cost-related forgone medical care as Albany County's highest rate in the Capital Region for the cited period.", exactExcerpt: "Albany County had the highest rate in the Capital Region of adults who did not receive medical care due to cost in 2021, although the rate ranked in the top half of NYS counties and was lower than NYS, excluding NYC rate (BRFSS)", page: 17, section: "Albany County — General Health Status", reviewStatus: "provisional" },
      { id: "claim:albany-diabetes-disparity", documentId: "document:albany-capital-region-chna-2025", type: "disparity", statement: "The assessment reports a large racial disparity in diabetes hospitalizations in Albany County.", exactExcerpt: "Albany County’s 2020-2022 rate of diabetes hospitalizations was 3.9 times higher among Black non-Hispanic residents than White non-Hispanic residents (NYS CHIRE)", page: 17, section: "Albany County — Chronic Disease", reviewStatus: "provisional" },
    ],
    decisionsRequired: [
      "Confirm whether a current Albany County-specific improvement plan exists and supersedes or complements the regional CHNA.",
      "Approve, revise, or reject each extracted claim after checking the source page.",
      "Do not infer a countywide intervention from a regional document without local partner review.",
    ],
  },
};

const bexar: CaseForActionPackage = {
  id: "case-for-action:county-48029:review-v1",
  schemaVersion: CASE_FOR_ACTION_SCHEMA_VERSION,
  releaseStatus: "review_only",
  generatedAt: GENERATED_AT,
  editable: true,
  place: {
    geographyId: "county:48029",
    kind: "county",
    fips: "48029",
    displayName: "Bexar County, Texas",
    state: "Texas",
    population: 2087679,
    geographyCaveat: "The evidence applies to Bexar County as a whole. It must not be represented as specific to every ZIP Code, city, neighborhood, or rural area within the county.",
  },
  executiveSummary: "Verified county-level public data identifies several adverse signals, including the estimate for adults without health insurance. A University Health assessment and implementation strategy has been cataloged, but it is hospital-specific and its extracted claims remain provisional. The evidence supports a structured local partner review—not an automatic intervention decision.",
  evidenceStatus: { localPlan: "not_yet_verified", publicData: "verified", resourceCoverage: "no_verified_records" },
  localPlan: {
    publicStatement: "University Health’s 2026–2028 assessment and implementation strategy has been cataloged. Because it is hospital-specific and its claim-level review is incomplete, it is not presented as Bexar County’s current plan or as verified county-plan alignment.",
    verifiedAlignment: [],
    documents: [{
      id: "document:university-health-bexar-implementation-2026",
      title: "University Health Community Health Needs Assessment and Implementation Strategy for Bexar County, 2026–2028",
      publisher: "University Health",
      officialUrl: "https://www.universityhealth.com/-/media/Files/About-Us/Community-Health-Needs-Assessment/Community-Health-Needs-Implementation-Strategy-2026.ashx",
      publicationDate: "2026-03",
      planCycle: "2026–2028",
      coverage: "hospital_specific",
      currentPlanStatus: "not_applicable",
      reviewStatus: "provisional",
    }],
  },
  publicData: {
    publicStatement: "The comparison below uses age-adjusted CDC PLACES modeled county estimates. It shows area-level signals that require local interpretation; it does not establish individual risk or a local planning priority.",
    signals: [
      signal({ id: "bexar-uninsured", label: "Adults without health insurance", definition: "Estimated share of adults ages 18–64 without current health insurance.", category: "practical_barrier", localValue: 21.9, comparisonValue: 11.7, comparisonLabel: COMPARISON_LABEL, difference: 10.2, direction: "adverse", interpretation: "adverse_signal", confidenceInterval: "17.6–26.7", geographyId: "county:48029" }),
      signal({ id: "bexar-short-sleep", label: "Short sleep duration", definition: "Estimated share of adults who usually sleep fewer than seven hours in a 24-hour period.", category: "context", localValue: 41.2, comparisonValue: 37.3, comparisonLabel: COMPARISON_LABEL, difference: 3.9, direction: "adverse", interpretation: "adverse_signal", confidenceInterval: "37.6–44.8", geographyId: "county:48029" }),
      signal({ id: "bexar-diabetes", label: "Diagnosed diabetes", definition: "Estimated share of adults living with diagnosed diabetes.", category: "chronic_condition", localValue: 13.8, comparisonValue: 11.2, comparisonLabel: COMPARISON_LABEL, difference: 2.6, direction: "adverse", interpretation: "adverse_signal", confidenceInterval: "12.1–15.5", geographyId: "county:48029" }),
      signal({ id: "bexar-dental", label: "Dental visit", definition: "Estimated share of adults who visited a dentist or dental clinic in the past year.", category: "preventive_service", localValue: 55.1, comparisonValue: 57.3, comparisonLabel: COMPARISON_LABEL, difference: -2.2, direction: "protective", interpretation: "adverse_signal", confidenceInterval: "52.2–57.9", geographyId: "county:48029" }),
    ],
  },
  practicalBarriers: [{
    title: "Health insurance coverage",
    statement: "The modeled estimate for adults without health insurance is 21.9%, compared with 11.7% across U.S. county estimates in the same release. This is an area-level access signal and requires local interpretation.",
    signalId: "bexar-uninsured",
  }],
  resourceCoverage: {
    publicStatement: "No SozoRock, community, or provider resource record has completed verification for display in this brief. University Health is a document publisher in this evidence set; the record does not establish a SozoRock partnership.",
    resources: [],
  },
  responseConcept: {
    responseType: "health_access_day",
    status: "requires local partner review",
    title: "Health Access Day readiness conversation",
    summary: "The public-data signals support convening local partners to test whether a targeted, non-clinical Health Access Day concept fits current priorities, avoids duplication, and can connect residents to licensed-provider pathways.",
    pathway: [
      { stage: "Evidence", statement: "County-level insurance, sleep, diabetes, and dental estimates are current and source-traceable.", status: "verified" },
      { stage: "Practical barrier", statement: "Insurance coverage is an adverse area-level access signal; other practical barriers require local verification.", status: "verified" },
      { stage: "Potential response", statement: "Test a targeted Health Access Day concept; do not launch from this brief alone.", status: "proposed_for_partner_review" },
      { stage: "Partner role", statement: "Local agencies validate priorities; licensed providers own clinical services; community partners confirm reach and existing capacity.", status: "proposed_for_partner_review" },
      { stage: "Measure of progress", statement: "Agree on readiness, reach, referral, and partner-coverage measures before implementation.", status: "proposed_for_partner_review" },
    ],
  },
  progressMeasures: [
    { id: "bexar-priority-validation", label: "Priority validation", definition: "Number of proposed focus areas confirmed against a verified current local plan and local partner review.", status: "proposed_for_partner_review" },
    { id: "bexar-readiness-completion", label: "Non-clinical readiness completion", definition: "Share of participating residents who complete the agreed non-clinical preparation step for an existing provider-led pathway.", status: "proposed_for_partner_review" },
    { id: "bexar-provider-handoffs", label: "Provider-owned pathway handoffs", definition: "Number and share of consented handoffs accepted into a participating licensed provider’s own platform or process.", status: "proposed_for_partner_review" },
    { id: "bexar-coverage", label: "Verified partner coverage", definition: "Count and geographic reach of verified agencies, community institutions, and licensed providers with defined roles.", status: "proposed_for_partner_review" },
  ],
  evidenceGaps: [
    "A verified current county-specific CHA, CHIP, or comparable public-health plan.",
    "Verified local resource, service-capacity, and partner coverage.",
    "Location-specific workforce shortage evidence from an approved HRSA import.",
    "Subcounty evidence needed to test differences across rural areas, the South Side, the West Side, and other communities.",
    "Local confirmation of duplication risk, feasible scope, partner roles, and implementation measures.",
  ],
  sources: [
    ...sharedSources,
    {
      id: "university-health-bexar-implementation-2026",
      publisher: "University Health",
      title: "Community Health Needs Assessment and Implementation Strategy for Bexar County, 2026–2028",
      officialUrl: "https://www.universityhealth.com/-/media/Files/About-Us/Community-Health-Needs-Assessment/Community-Health-Needs-Implementation-Strategy-2026.ashx",
      releaseDate: "2026-03",
      dataPeriod: "2026–2028 implementation strategy; underlying 2025 CHNA",
      retrievedAt: "2026-07-21T00:00:00Z",
      geography: "Hospital-specific strategy for Bexar County service area",
      reviewStatus: "provisional",
      use: "local_plan",
    },
  ],
  disclosures: [
    "CDC PLACES values are modeled area estimates, not diagnoses, patient counts, or proof that a local response will cause an outcome.",
    "This review-only brief does not provide medical advice and does not authorize an intervention.",
    "Local partners must confirm priorities, existing work, feasibility, roles, and measures before action.",
  ],
  internalReview: {
    summary: "Four candidate claims were extracted from a hospital-specific document. They remain provisional and are excluded from the public narrative until exact citations and scope are approved.",
    claimsAwaitingReview: [
      { id: "claim:bexar-priority-categories", documentId: "document:university-health-bexar-implementation-2026", type: "priority", statement: "The 2025 Bexar CHNA organizes identified needs into three explicit priority categories.", exactExcerpt: "The data are disaggregated to identify and describe health disparities and are grouped into three categories of priorities: What We Need for Health; How We are Taking Care of Ourselves; How We are Faring", page: 2, section: "Executive Summary", reviewStatus: "provisional" },
      { id: "claim:bexar-geographic-digital-barriers", documentId: "document:university-health-bexar-implementation-2026", type: "barrier", statement: "The assessment identifies rural, South Side, and West Side access disparities, including digital and transportation barriers.", exactExcerpt: "For rural areas, in particular, there was discussion about digital equity and access", page: 8, section: "Geographic disparities", reviewStatus: "provisional" },
      { id: "claim:bexar-access-objective", documentId: "document:university-health-bexar-implementation-2026", type: "objective", statement: "University Health's strategy explicitly aims to improve prevention, disease-management, and well-being access.", exactExcerpt: "Improve access to care & services that promote prevention, disease management & overall well-being", page: 15, section: "How We are Taking Care of Ourselves", reviewStatus: "provisional" },
      { id: "claim:bexar-sdoh-evaluation", documentId: "document:university-health-bexar-implementation-2026", type: "evaluation_measure", statement: "The strategy reports a concrete screening measure for adult inpatients.", exactExcerpt: "In 2025, 76% of admitted adult patients were screened for SDOH.", page: 9, section: "Impact Evaluation", reviewStatus: "provisional" },
    ],
    decisionsRequired: [
      "Confirm the latest county-led CHA/CHIP source independently of University Health’s hospital strategy.",
      "Approve, revise, or reject each extracted claim after checking the source page.",
      "Confirm subcounty geography before using any rural, South Side, or West Side statement in a public brief.",
      "Verify existing resources and partnerships; document publication is not evidence of partnership.",
    ],
  },
};

export const PARTNER_EVIDENCE_REVIEW_CASES = {
  albany: albany,
  bexar: bexar,
} as const satisfies Record<string, CaseForActionPackage>;

for (const value of Object.values(PARTNER_EVIDENCE_REVIEW_CASES)) {
  const errors = validateCaseForAction(value);
  if (errors.length) throw new Error(`${value.id} failed validation: ${errors.join(" ")}`);
}
