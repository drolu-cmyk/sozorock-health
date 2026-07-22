import { createHash } from "node:crypto";
import { SOURCE_CATALOG } from "../source-catalog.ts";
import type {
  EvidenceCitation,
  EvidenceClaim,
  Geography,
  MeasureDefinition,
  MetricObservation,
  PlanningDocument,
  SourceVersion,
} from "../contracts.ts";
import type { GeographyCatalog } from "../geography.ts";
import type { PlaceEvidenceSnapshot } from "./types.ts";

const CREATED_AT = "2026-07-22T16:00:00Z";
const HASH = `sha256:${"b".repeat(64)}`;

const counties = [
  ["36001", "36", "Albany County, New York"],
  ["36093", "36", "Schenectady County, New York"],
  ["36057", "36", "Montgomery County, New York"],
  ["42029", "42", "Chester County, Pennsylvania"],
  ["48029", "48", "Bexar County, Texas"],
] as const;

const geographies: Geography[] = counties.map(([countyFips, stateFips, displayName]) => ({
  id: `county:${countyFips}`,
  kind: "county",
  authority: "census",
  authorityId: countyFips,
  name: displayName,
  displayName,
  stateFips,
  countyFips,
  vintage: "2025",
  validFrom: null,
  validTo: null,
  reviewStatus: "verified",
  caveat: "Evaluation fixture: geography identity is real; metric values are controlled policy-test inputs and must not be published.",
}));

geographies.push({
  id: "zcta:12207",
  kind: "zcta",
  authority: "census",
  authorityId: "12207",
  name: "ZCTA 12207",
  displayName: "ZCTA 12207",
  stateFips: "36",
  countyFips: null,
  vintage: "2025",
  validFrom: null,
  validTo: null,
  reviewStatus: "verified",
  caveat: "Evaluation fixture used to verify that county evidence is never represented as ZCTA evidence.",
});

const geographyCatalog: GeographyCatalog = {
  geographies,
  aliases: [],
  relationships: [{
    id: "relationship:zcta-12207:county-36001",
    fromGeographyId: "zcta:12207",
    toGeographyId: "county:36001",
    kind: "overlaps",
    sourceVersionId: "source-version:census-2025-eval",
    vintage: "2025",
    overlapAreaPercent: 100,
    overlapPopulationPercent: null,
    method: "Controlled evaluation relationship; not a production crosswalk.",
    caveat: "County evidence remains county evidence even where a ZCTA overlaps the county.",
    reviewStatus: "verified",
  }],
};

const sourceVersions: SourceVersion[] = [
  {
    id: "source-version:census-2025-eval",
    sourceId: "census-geography",
    releaseLabel: "2025 Census geography evaluation snapshot",
    releaseDate: "2025-12-31",
    dataPeriodStart: "2025-01-01",
    dataPeriodEnd: "2025-12-31",
    retrievedAt: CREATED_AT,
    staleAfter: "2027-01-01T00:00:00Z",
    officialUrl: "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
    contentHash: HASH,
    schemaVersion: "evaluation-geography.v1",
    reviewStatus: "verified",
    reviewedBy: "evaluation-policy@sozorockfoundation.org",
    reviewedAt: CREATED_AT,
  },
  {
    id: "source-version:cdc-places-current-eval",
    sourceId: "cdc-places",
    releaseLabel: "Controlled current-evidence evaluation fixture",
    releaseDate: "2025-12-04",
    dataPeriodStart: "2023-01-01",
    dataPeriodEnd: "2023-12-31",
    retrievedAt: CREATED_AT,
    staleAfter: "2027-01-01T00:00:00Z",
    officialUrl: "https://www.cdc.gov/places/",
    contentHash: HASH,
    schemaVersion: "evaluation-observations.v1",
    reviewStatus: "verified",
    reviewedBy: "evaluation-policy@sozorockfoundation.org",
    reviewedAt: CREATED_AT,
  },
  {
    id: "source-version:cdc-places-stale-eval",
    sourceId: "cdc-places",
    releaseLabel: "Controlled stale-evidence evaluation fixture",
    releaseDate: "2024-01-01",
    dataPeriodStart: "2021-01-01",
    dataPeriodEnd: "2021-12-31",
    retrievedAt: "2024-02-01T00:00:00Z",
    staleAfter: "2025-01-01T00:00:00Z",
    officialUrl: "https://www.cdc.gov/places/",
    contentHash: HASH,
    schemaVersion: "evaluation-observations.v1",
    reviewStatus: "verified",
    reviewedBy: "evaluation-policy@sozorockfoundation.org",
    reviewedAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "source-version:albany-plan-eval",
    sourceId: "local-planning-documents",
    releaseLabel: "Controlled verified-plan evaluation fixture",
    releaseDate: "2026-01-01",
    dataPeriodStart: "2026-01-01",
    dataPeriodEnd: "2029-12-31",
    retrievedAt: CREATED_AT,
    staleAfter: "2027-01-01T00:00:00Z",
    officialUrl: "https://www.albanycountyny.gov/departments/health/data-statistics",
    contentHash: HASH,
    schemaVersion: "evaluation-planning.v1",
    reviewStatus: "verified",
    reviewedBy: "evaluation-policy@sozorockfoundation.org",
    reviewedAt: CREATED_AT,
  },
  {
    id: "source-version:schenectady-plan-provisional-eval",
    sourceId: "local-planning-documents",
    releaseLabel: "Controlled provisional-plan evaluation fixture",
    releaseDate: "2025-01-01",
    dataPeriodStart: null,
    dataPeriodEnd: null,
    retrievedAt: CREATED_AT,
    staleAfter: "2027-01-01T00:00:00Z",
    officialUrl: "https://www.schenectadycountyny.gov/public-health",
    contentHash: HASH,
    schemaVersion: "evaluation-planning.v1",
    reviewStatus: "provisional",
    reviewedBy: null,
    reviewedAt: null,
  },
];

const measures: MeasureDefinition[] = [
  {
    id: "measure:adverse-eval",
    sourceMeasureId: "ADVERSE_EVAL",
    name: "Controlled adverse-direction measure",
    description: "Policy fixture used to test response-fit safeguards; not a publishable health statistic.",
    direction: "adverse",
    higherValueMeaning: "adverse",
    unit: "percent",
    universe: "Evaluation fixture",
    adjustment: "modeled",
    comparisonPolicy: "higher_is_concern",
    reviewStatus: "verified",
  },
  {
    id: "measure:protective-eval",
    sourceMeasureId: "PROTECTIVE_EVAL",
    name: "Controlled preventive-service measure",
    description: "Policy fixture used to prove that favorable measures are not ranked as problems.",
    direction: "protective",
    higherValueMeaning: "favorable",
    unit: "percent",
    universe: "Evaluation fixture",
    adjustment: "modeled",
    comparisonPolicy: "lower_is_concern",
    reviewStatus: "verified",
  },
];

function observation(
  id: string,
  geographyId: string,
  measureDefinitionId: string,
  value: number,
  sourceVersionId = "source-version:cdc-places-current-eval",
): MetricObservation {
  return {
    id,
    measureDefinitionId,
    geographyId,
    sourceVersionId,
    sourceRecordId: `controlled-evaluation:${id}`,
    sourceUrl: "https://www.cdc.gov/places/",
    geographyLevel: "county",
    value,
    numericValue: value,
    confidenceLow: null,
    confidenceHigh: null,
    marginOfError: null,
    releaseDate: sourceVersions.find((item) => item.id === sourceVersionId)?.releaseDate ?? "2025-12-04",
    dataPeriodStart: sourceVersions.find((item) => item.id === sourceVersionId)?.dataPeriodStart ?? null,
    dataPeriodEnd: sourceVersions.find((item) => item.id === sourceVersionId)?.dataPeriodEnd ?? null,
    retrievedAt: sourceVersions.find((item) => item.id === sourceVersionId)?.retrievedAt ?? CREATED_AT,
    reviewStatus: "verified",
    suppressionReason: null,
    sourceMetadata: {
      evaluationFixture: true,
      publishable: false,
      comparisonInterpretation: measureDefinitionId === "measure:adverse-eval" ? "adverse_signal" : "favorable_signal",
    },
  };
}

const observations: MetricObservation[] = [
  observation("observation:albany-adverse", "county:36001", "measure:adverse-eval", 14),
  observation("observation:schenectady-adverse", "county:36093", "measure:adverse-eval", 13),
  observation("observation:schenectady-protective", "county:36093", "measure:protective-eval", 82),
  observation("observation:montgomery-stale", "county:36057", "measure:adverse-eval", 13, "source-version:cdc-places-stale-eval"),
  observation("observation:chester-protective", "county:42029", "measure:protective-eval", 84),
];

const albanyPlan: PlanningDocument = {
  id: "document:albany-plan-eval",
  sourceVersionId: "source-version:albany-plan-eval",
  documentType: "chip",
  title: "Controlled Albany verified-plan evaluation fixture",
  publisher: "Albany County Department of Health",
  officialUrl: "https://www.albanycountyny.gov/departments/health/data-statistics",
  publishedAt: "2026-01-01",
  periodStart: "2026-01-01",
  periodEnd: "2029-12-31",
  geographyIds: ["county:36001"],
  contentHash: HASH,
  pageCount: 10,
  coverageScope: "county_specific",
  currentPlanStatus: "verified_current",
  reviewStatus: "verified",
  reviewedBy: "evaluation-policy@sozorockfoundation.org",
  reviewedAt: CREATED_AT,
};

const provisionalPlan: PlanningDocument = {
  ...albanyPlan,
  id: "document:schenectady-plan-provisional-eval",
  sourceVersionId: "source-version:schenectady-plan-provisional-eval",
  title: "Controlled Schenectady provisional-plan evaluation fixture",
  publisher: "Schenectady County Public Health Services",
  officialUrl: "https://www.schenectadycountyny.gov/public-health",
  geographyIds: ["county:36093"],
  currentPlanStatus: "not_yet_verified",
  reviewStatus: "provisional",
  reviewedBy: null,
  reviewedAt: null,
};

const claim: EvidenceClaim = {
  id: "claim:albany-barrier-eval",
  documentId: albanyPlan.id,
  geographyIds: ["county:36001"],
  claimType: "barrier",
  statement: "A controlled evaluation barrier is explicitly named in the verified test plan.",
  exactExcerpt: "Controlled evaluation text: the test plan explicitly names an access barrier.",
  extractionMethod: "human",
  confidence: "high",
  reviewStatus: "verified",
  reviewedBy: "evaluation-policy@sozorockfoundation.org",
  reviewedAt: CREATED_AT,
};

const citation: EvidenceCitation = {
  id: "citation:albany-barrier-eval",
  claimId: claim.id,
  documentId: albanyPlan.id,
  sourceVersionId: albanyPlan.sourceVersionId,
  pageNumber: 4,
  artifactPageIndex: 3,
  section: "Controlled evaluation section",
  paragraph: null,
  sourceField: null,
  quotedText: claim.exactExcerpt,
  quotedTextHash: `sha256:${createHash("sha256").update(claim.exactExcerpt).digest("hex")}`,
  locatorBoundingBox: null,
  reviewStatus: "verified",
};

export const PLACE_AGENT_EVALUATION_SNAPSHOT: PlaceEvidenceSnapshot = {
  snapshotId: "place-agent-evaluation-fixture.v1",
  createdAt: CREATED_AT,
  geographyCatalog,
  geographySourceVersionByGeographyId: Object.fromEntries(geographies.map((item) => [item.id, "source-version:census-2025-eval"])),
  sourceCatalog: SOURCE_CATALOG,
  sourceVersions,
  measureDefinitions: measures,
  observations,
  planningDocuments: [albanyPlan, provisionalPlan],
  claims: [claim],
  citations: [citation],
};

export const PLACE_AGENT_EVALUATION_PLACES = counties.map(([countyFips, , name]) => ({
  name,
  geographyId: `county:${countyFips}`,
}));
