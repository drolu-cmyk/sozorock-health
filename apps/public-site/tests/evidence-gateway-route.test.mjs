import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../app/api/evidence/v1/gateway/route.ts", import.meta.url),
  "utf8",
);
const loader = readFileSync(
  new URL("../app/lib/published-evidence-gateway.ts", import.meta.url),
  "utf8",
);
const planningLoader = readFileSync(
  new URL("../app/lib/published-planning-evidence.ts", import.meta.url),
  "utf8",
);
const planningSerializer = readFileSync(
  new URL("../../../packages/evidence-core/src/evidence-gateway-planning.ts", import.meta.url),
  "utf8",
);

test("Evidence Gateway route is pinned to the published evidence authority and public rate limit", () => {
  assert.match(route, /enforceEvidenceRateLimit/);
  assert.match(route, /requirePublishedEvidenceSnapshot/);
  assert.match(route, /requireEvidenceGeographyId/);
  assert.match(route, /placeAgentRuntimeVersions\.snapshotContentHash/);
  assert.match(route, /getPublishedEvidenceGateway/);
});

test("Evidence Gateway planning evidence is attached before the release hash is served", () => {
  assert.match(route, /getPublishedPlanningEvidenceExtension/);
  assert.match(route, /attachPlanningEvidenceToGatewayV1/);
  assert.match(route, /X-Evidence-Planning-Contract/);
  assert.match(planningSerializer, /JSON\.stringify\(combinedPackage\)/);
  assert.match(planningSerializer, /release_hash: releaseHash/);
});

test("Evidence Gateway transport is release-hash cache bound", () => {
  assert.match(route, /response\.manifest\.release_hash/);
  assert.match(route, /ETag/);
  assert.match(route, /if-none-match/);
  assert.match(route, /status: 304/);
  assert.match(route, /X-Evidence-Contract/);
  assert.match(route, /X-Evidence-Release-Hash/);
});

test("Evidence Gateway errors are never publicly cached", () => {
  assert.match(route, /"Cache-Control": "no-store"/);
});

test("published gateway loader reuses the canonical serializer and source coverage review state", () => {
  assert.match(loader, /buildEvidenceGatewayResponseV1/);
  assert.match(loader, /coverage_key/);
  assert.match(loader, /review_status::text/);
  assert.match(loader, /source_version_id IS NOT NULL/);
  assert.match(loader, /complete_no_records/);
  assert.match(loader, /partially_available/);
});

test("planning loader admits only reviewed exact-county records from the published snapshot", () => {
  assert.match(planningLoader, /snapshot_source_version/);
  assert.match(planningLoader, /document\.coverage_scope='county_specific'/);
  assert.match(planningLoader, /document\.review_status='verified'/);
  assert.match(planningLoader, /claim\.review_status='verified'/);
  assert.match(planningLoader, /citation\.review_status='verified'/);
  assert.match(planningLoader, /citation\.page_number IS NOT NULL/);
  assert.match(planningLoader, /nullif\(btrim\(citation\.section\), ''\) IS NOT NULL/);
  assert.match(planningLoader, /count\(\*\)/);
  assert.match(planningSerializer, /planning_documents/);
  assert.match(planningSerializer, /planning_claims/);
  assert.match(planningSerializer, /planning_citations/);
  assert.equal(planningSerializer.includes("quoted_text:"), false);
});

test("public gateway transport contains no private CB-CAP tenant or decision-state query", () => {
  const combined = `${route}\n${loader}\n${planningLoader}\n${planningSerializer}`.toLowerCase();
  for (const forbidden of [
    "tenant_id",
    "funding_fit",
    "decision_memory",
    "trajectory_event",
    "publication_approved",
  ]) {
    assert.equal(combined.includes(forbidden), false, `public gateway must not reference ${forbidden}`);
  }
});
