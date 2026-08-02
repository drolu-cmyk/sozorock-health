import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { selectPinnedSnapshot } from "../app/lib/snapshot-pin-policy.ts";
import { recomputeEvidenceAssessment } from "../../../packages/evidence-core/src/national/county-brief.ts";

const runtime = await readFile(new URL("../app/lib/published-evidence-runtime.ts", import.meta.url), "utf8");
const authority = await readFile(new URL("../app/lib/evidence-runtime-authority.ts", import.meta.url), "utf8");
const exploreRoute = await readFile(new URL("../app/api/explore/route.ts", import.meta.url), "utf8");
const workspace = await readFile(new URL("../app/lib/explore-workspace-runtime.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../../../packages/evidence-core/migrations/0010_field_level_provenance.sql", import.meta.url), "utf8");

const hashA = `sha256:${"a".repeat(64)}`;
const hashB = `sha256:${"b".repeat(64)}`;

test("configured snapshot hash wins over a newer published snapshot", () => {
  const selected = selectPinnedSnapshot([
    { id: "new", contentHash: hashB, reviewStatus: "verified", publishedAt: "2026-08-01", sourceVersions: [{ sourceId: "cdc-places", reviewStatus: "verified" }] },
    { id: "old", contentHash: hashA, reviewStatus: "verified", publishedAt: "2026-07-01", sourceVersions: [{ sourceId: "cdc-places", reviewStatus: "verified" }] },
  ], hashA);
  assert.equal(selected?.id, "old");
});

test("unknown, unpublished, unverified and incomplete snapshots fail closed", () => {
  assert.equal(selectPinnedSnapshot([], hashA), null);
  assert.equal(selectPinnedSnapshot([{ id: "x", contentHash: hashA, reviewStatus: "verified", publishedAt: null, sourceVersions: [{ sourceId: "cdc-places", reviewStatus: "verified" }] }], hashA), null);
  assert.equal(selectPinnedSnapshot([{ id: "x", contentHash: hashA, reviewStatus: "provisional", publishedAt: "2026-08-01", sourceVersions: [{ sourceId: "cdc-places", reviewStatus: "verified" }] }], hashA), null);
  assert.equal(selectPinnedSnapshot([{ id: "x", contentHash: hashA, reviewStatus: "verified", publishedAt: "2026-08-01", sourceVersions: [{ sourceId: "cdc-places", reviewStatus: "provisional" }] }], hashA), null);
  assert.equal(selectPinnedSnapshot([{ id: "x", contentHash: hashA, reviewStatus: "verified", publishedAt: "2026-08-01", sourceVersions: [] }], hashA), null);
});

test("runtime queries are hash-pinned, workforce is snapshot-linked, and the Explore route loads one brief", () => {
  assert.match(runtime, /s\.content_hash=:content_hash/);
  assert.doesNotMatch(runtime, /ORDER BY s\.published_at DESC/);
  assert.match(runtime, /snapshot\.content_hash=:snapshot_hash/);
  assert.match(runtime, /snapshot_source_version link ON link\.source_version_id=d\.source_version_id/);
  assert.match(runtime, /sv\.source_id='hrsa-workforce'/);
  assert.match(runtime, /o\.source_version_id IN \(\$\{contextSourceIds\.map\(\(_, index\) => `CAST\(:context_source_\$\{index\} AS uuid\)`/);
  assert.match(runtime, /runtimeRecordCache\.set\(`\$\{geoid\}:\$\{contentHash\}`/);
  assert.match(exploreRoute, /const brief = await getPublishedCountyBrief\(evidenceGeoid\)/);
  assert.match(exploreRoute, /const record = await getPublishedCountyRecord\(evidenceGeoid\)/);
  assert.equal((exploreRoute.match(/getPublishedCountyBrief\(evidenceGeoid\)/g) ?? []).length, 1);
});

test("authority validates the configured hash before querying and does not choose latest", () => {
  assert.match(authority, /assertSnapshotContentHash/);
  assert.doesNotMatch(authority, /ORDER BY s\.published_at DESC/);
});

test("public share projection never calls the internal plan loader and excludes sensitive fields", () => {
  const shareStart = workspace.indexOf("export async function getSharedWorkspacePlan");
  const shareBody = workspace.slice(shareStart, workspace.indexOf("export async function createWorkspaceHandoff", shareStart));
  assert.doesNotMatch(shareBody, /loadWorkspacePlan/);
  assert.match(workspace, /loadPublicWorkspacePlan/);
  assert.match(workspace, /PUBLIC_SECTION_KEYS/);
  assert.match(workspace, /PUBLIC_CONTENT_KEYS/);
  for (const forbidden of ["actorId", "assignedTo", "reviewedBy", "presence", "invitations", "pending"]) {
    assert.doesNotMatch(shareBody, new RegExp(`\\b${forbidden}\\b`));
  }
});

test("trusted membership events preserve the viewer write prohibition", () => {
  assert.match(workspace, /trustedMembershipAuthorization/);
  assert.match(workspace, /appendTrustedMembershipEvent/);
  assert.match(workspace, /trustedMembership && !\["participant_joined", "workspace_handoff_accepted"\]/);
  assert.match(workspace, /!trustedMembership && \(!access \|\| access === "viewer"\)/);
  assert.match(workspace, /intended_principal_id/);
  assert.match(workspace, /target_principal_id/);
});

function briefWithCoverage(status) {
  return {
    contractVersion: "explore.place-brief.v1",
    generatedAt: "2026-08-01",
    evidenceSnapshotId: "snapshot:one",
    policyVersion: "policy.v1",
    query: { raw: "36001", kind: "county_fips" },
    resolution: { status: "resolved", selected: { id: "g", kind: "county", authority: "census", authorityId: "36001", displayName: "Albany County, NY", vintage: "2025", reviewStatus: "verified" }, evidenceGeographies: [], overlappingCounties: [], caveats: [] },
    localPlanningEvidence: { status: "not_yet_verified", documents: [], claims: [] },
    publicData: {
      observations: [{ id: "o", measureDefinitionId: "m", label: "Transportation", direction: "adverse", unit: "percent", universe: "Households", adjustment: "modeled", value: 8, confidence: { low: 7, high: 9, marginOfError: null }, geographyId: "g", sourceVersionId: "sv", releaseDate: "2026-01-01", dataPeriod: { start: "2024-01-01", end: "2024-12-31" }, reviewStatus: "verified", interpretation: "not_rankable", benchmarkObservationId: null, citationIds: ["c"] }],
      sources: [{ sourceId: "cdc-places", sourceVersionId: "sv", publisher: "CDC", title: "PLACES", officialUrl: "https://data.cdc.gov", releaseDate: "2026-01-01", dataPeriod: { start: "2024-01-01", end: "2024-12-31" }, retrievedAt: "2026-02-01", reviewStatus: "verified" }],
      sourceCoverage: [{ sourceId: "cdc-places", status, reason: status === "available" ? "available" : "missing", sourceVersionId: status === "available" ? "sv" : null, geographyKind: "county", observationCount: status === "available" ? 1 : 0, releaseDate: status === "available" ? "2026-01-01" : null, dataPeriod: { start: null, end: null }, retrievedAt: null }],
    },
    citations: [{ id: "c", sourceVersionId: "sv", documentId: null, officialUrl: "https://data.cdc.gov", pageNumber: null, section: null, sourceField: "COPD", quotedText: null, reviewStatus: "verified" }],
    evidenceAssessment: { known: [], missing: [], requiresLocalReview: [], responseFits: [] },
    safety: { classification: "non_clinical_place_evidence", containsPhi: false, limitations: [] },
  };
}

test("assessment is recomputed from final coverage rather than fixture-era gaps", () => {
  const available = recomputeEvidenceAssessment(briefWithCoverage("available"));
  assert.equal(available.missing.length, 0);
  const missing = recomputeEvidenceAssessment(briefWithCoverage("unavailable_from_source"));
  assert.match(missing.missing[0], /unavailable from source/);
});

test("ACS migration persists direct and derived field provenance without fabricating old rows", () => {
  assert.match(migration, /source_variable_id/);
  assert.match(migration, /source_numerator_variable_id/);
  assert.match(migration, /source_denominator_variable_id/);
  assert.match(migration, /source_formula/);
  assert.match(migration, /source_variable_id = NULLIF/);
  assert.match(migration, /rows without verified provenance remain incomplete/);
});
