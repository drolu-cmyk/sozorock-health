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

test("Evidence Gateway route is pinned to the published evidence authority and public rate limit", () => {
  assert.match(route, /enforceEvidenceRateLimit/);
  assert.match(route, /requirePublishedEvidenceSnapshot/);
  assert.match(route, /requireEvidenceGeographyId/);
  assert.match(route, /placeAgentRuntimeVersions\.snapshotContentHash/);
  assert.match(route, /getPublishedEvidenceGateway/);
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

test("public gateway transport contains no private CB-CAP tenant or decision-state query", () => {
  const combined = `${route}\n${loader}`.toLowerCase();
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
