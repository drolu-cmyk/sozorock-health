import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { selectPinnedSnapshot } from "../app/lib/snapshot-pin-policy.ts";
import { recomputeEvidenceAssessment } from "../../../packages/evidence-core/src/national/county-brief.ts";
import { projectPublicWorkspacePlan } from "../app/lib/public-workspace-share.ts";

const runtime = await readFile(new URL("../app/lib/published-evidence-runtime.ts", import.meta.url), "utf8");
const publishedRuntime = runtime;
const authority = await readFile(new URL("../app/lib/evidence-runtime-authority.ts", import.meta.url), "utf8");
const exploreRoute = await readFile(new URL("../app/api/explore/route.ts", import.meta.url), "utf8");
const workspace = await readFile(new URL("../app/lib/explore-workspace-runtime.ts", import.meta.url), "utf8");
const publicShare = await readFile(new URL("../app/lib/public-workspace-share.ts", import.meta.url), "utf8");
const shareRoute = await readFile(new URL("../app/api/evidence/v1/workspace-share/route.ts", import.meta.url), "utf8");
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
  assert.match(runtime, /o\.source_version_id=CAST\(:source_version_id AS uuid\)/);
  assert.match(runtime, /snapshot_source_version link ON link\.source_version_id=d\.source_version_id/);
  assert.match(runtime, /sv\.source_id='hrsa-workforce'/);
  assert.match(runtime, /o\.source_version_id IN \(\$\{contextSourceIds\.map\(\(_, index\) => `CAST\(:context_source_\$\{index\} AS uuid\)`/);
  assert.match(runtime, /runtimeRecordCache\.set\(`\$\{geoid\}:\$\{contentHash\}`/);
  assert.match(exploreRoute, /const evidence = await getPublishedCountyEvidence\(evidenceGeoid\)/);
  assert.doesNotMatch(exploreRoute, /getPublishedCountyRecord\(evidenceGeoid\)/);
  assert.equal((exploreRoute.match(/getPublishedCountyEvidence\(evidenceGeoid\)/g) ?? []).length, 1);
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
   assert.match(publicShare, /PUBLIC_SECTION_KEYS/);
   assert.match(publicShare, /PUBLIC_CONTENT_KEYS/);
  for (const forbidden of ["actorId", "assignedTo", "reviewedBy", "presence", "invitations", "pending"]) {
    assert.doesNotMatch(shareBody, new RegExp(`\\b${forbidden}\\b`));
  }
});

test("public share serialization is an allowlist and excludes unreviewed/internal content", () => {
  const projected = projectPublicWorkspacePlan({
    workspace: { title: "Albany plan", version: 3, updatedAt: "2026-08-01", geoid: "36001", geographyName: "Albany County" },
    sections: [
      {
        sectionKey: "summary",
        version: 1,
        updatedAt: "2026-08-01",
        content: {
          public: true,
          reviewStatus: "verified",
          title: "Approved summary",
          statement: "A reviewed statement.",
          citations: [{ publisher: "CDC", officialUrl: "https://data.cdc.gov", actorId: "must-not-leak" }],
          pending: "must-not-leak",
          internal: { prompt: "must-not-leak" },
        },
      },
      {
        sectionKey: "action",
        version: 1,
        updatedAt: "2026-08-01",
        content: { public: true, reviewStatus: "pending", statement: "Not ready" },
      },
    ],
    scenarios: [
      { name: "approved scenario", version: 1, output: { range: { low: 1 }, actorId: "must-not-leak" }, humanReviewStatus: "verified", createdAt: "2026-08-01" },
      { name: "pending scenario", version: 1, output: { range: { low: 1 } }, humanReviewStatus: "pending", createdAt: "2026-08-01" },
    ],
  });
  assert.equal(projected.sections.length, 1);
  assert.equal(projected.scenarios.length, 1);
  const serialized = JSON.stringify(projected);
  for (const forbidden of ["actorId", "pending", "prompt", "internal", "tenantId", "reviewedBy"]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden));
  }
  assert.match(serialized, /Approved summary/);
  assert.match(serialized, /data\.cdc\.gov/);
});

test("public share tokens are validated, uncached, and never broaden scope", () => {
  assert.match(workspace, /token_hash=:token_hash/);
  assert.match(workspace, /revoked_at IS NULL/);
  assert.match(workspace, /expires_at > now\(\)/);
  assert.match(workspace, /hashOpaqueToken\(input\.token\)/);
  assert.match(shareRoute, /Cache-Control.*no-store/);
  assert.match(workspace, /scope: share\.scope/);
  const responseBody = shareRoute.slice(shareRoute.indexOf("NextResponse.json"));
  assert.doesNotMatch(responseBody, /tenantId/);
});

test("trusted invitation and handoff events bind the persisted role to the server-authorized actor", () => {
  assert.match(workspace, /appendTrustedMembershipEvent/);
  assert.match(workspace, /role: role as WorkspaceRole/);
  assert.match(workspace, /role: targetRole as WorkspaceRole/);
  assert.match(workspace, /eventType: "participant_joined"/);
  assert.match(workspace, /eventType: "workspace_handoff_accepted"/);
  assert.match(workspace, /executeEvidenceTransaction/);
});

test("the unified county evidence loader performs one brief load per request", () => {
  const loaderStart = publishedRuntime.indexOf("export async function getPublishedCountyEvidence");
  const loaderBody = publishedRuntime.slice(loaderStart, publishedRuntime.indexOf("export async function getPublishedCountyBriefByIdentifier", loaderStart));
  assert.equal((loaderBody.match(/getPublishedCountyBrief\(geoid\)/g) ?? []).length, 1);
  assert.doesNotMatch(loaderBody, /getPublishedCountyRecord\(geoid\)/);
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

test("ACS backfill never promotes internal keys to official source fields", async () => {
  const repair = await readFile(new URL("../../../packages/evidence-core/migrations/0012_acs_provenance_backfill.sql", import.meta.url), "utf8");
  assert.match(repair, /source_variable_id = NULL/);
  assert.match(repair, /source_variable_id !~ '\^\[A-Z\]/);
  assert.match(repair, /source_metadata->>'numeratorVariableId'/);
  assert.match(repair, /source_metadata->>'denominatorVariableId'/);
  assert.match(repair, /source_estimate_field/);
});

test("snapshot geography preflight is pinned to the selected Census geography vintage", () => {
  assert.match(authority, /snapshotContentHash\?: string/);
  assert.match(authority, /s\.content_hash=:snapshot_hash/);
  assert.match(authority, /census_source\.source_id='census-geography'/);
  assert.match(authority, /g\.vintage=to_char\(census_source\.release_date/);
});
