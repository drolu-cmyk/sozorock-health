import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nationalDir = path.join(packageRoot, "data", "national");
const countyIndex = JSON.parse(
  await readFile(path.join(nationalDir, "county-index.v2025.json"), "utf8"),
) as { generatedAt: string; counties: Array<{ geoid: string; displayName: string; statePostalCode: string }> };
const pilotReview = JSON.parse(
  await readFile(path.join(packageRoot, "review", "milestone-3-pilot-evidence-review.json"), "utf8"),
) as {
  generatedAt: string;
  bundles: Array<{
    candidate: {
      id: string;
      title: string;
      publisher: string;
      sourcePageUrl: string;
      artifactUrl: string;
      documentType: string;
      coverageScope: string;
      publicationDate: string | null;
      reviewStatus: string;
    };
    document: { geographyIds: string[] };
    acceptedClaims: Array<{ geographyIds: string[] }>;
  }>;
};

const candidateByCounty = new Map<string, Array<Record<string, unknown>>>();
for (const bundle of pilotReview.bundles) {
  const countyGeoids = new Set([
    ...bundle.document.geographyIds,
    ...bundle.acceptedClaims.flatMap((claim) => claim.geographyIds),
  ].filter((id) => id.startsWith("county:")).map((id) => id.slice("county:".length)));
  for (const countyGeoid of countyGeoids) {
    const candidates = candidateByCounty.get(countyGeoid) ?? [];
    candidates.push({
      id: bundle.candidate.id,
      title: bundle.candidate.title,
      publisher: bundle.candidate.publisher,
      sourcePageUrl: bundle.candidate.sourcePageUrl,
      artifactUrl: bundle.candidate.artifactUrl,
      documentType: bundle.candidate.documentType,
      coverageScope: bundle.candidate.coverageScope,
      publicationDate: bundle.candidate.publicationDate,
      reviewStatus: bundle.candidate.reviewStatus,
    });
    candidateByCounty.set(countyGeoid, candidates);
  }
}

const counties = countyIndex.counties.map((county) => {
  const candidates = candidateByCounty.get(county.geoid) ?? [];
  return {
    countyGeoid: county.geoid,
    displayName: county.displayName,
    statePostalCode: county.statePostalCode,
    authorityDirectoryStatus: "awaiting_official_authority_mapping",
    discoveryStatus: candidates.length ? "candidate_documents_found" : "scheduled",
    lastDiscoveryCheckedAt: candidates.length ? pilotReview.generatedAt : null,
    nextDiscoveryCheck: "monthly",
    verificationStatus: candidates.some((candidate) => candidate.reviewStatus === "verified") ? "verified" : "not_yet_verified",
    publicationCoverageStatus: candidates.some((candidate) => candidate.reviewStatus === "verified") ? "verified_evidence_available" : candidates.length ? "candidate_only" : "none_discovered_yet",
    candidates,
  };
});

await writeFile(
  path.join(nationalDir, "local-plan-coverage-directory.v1.json"),
  `${JSON.stringify({
    schemaVersion: "sozorock.local-plan-coverage-directory.v1",
    generatedAt: new Date().toISOString(),
    releaseScope: "50 states and the District of Columbia",
    discoveryCadence: "monthly",
    approvedSourceFamilies: [
      "state clearinghouse",
      "county or local health department",
      "regional planning collaborative",
      "hospital CHNA or implementation-strategy publisher",
    ],
    publicationRule: "Only a named human reviewer can promote a candidate document or extracted claim to verified public evidence.",
    countyCount: counties.length,
    counties,
  })}\n`,
);

console.log(JSON.stringify({
  countyCount: counties.length,
  countiesWithCandidates: counties.filter((county) => county.candidates.length).length,
  verifiedCountyCount: counties.filter((county) => county.verificationStatus === "verified").length,
  output: "local-plan-coverage-directory.v1.json",
}, null, 2));
