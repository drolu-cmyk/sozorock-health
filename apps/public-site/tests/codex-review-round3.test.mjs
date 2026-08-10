import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nearestSameStateCountyGeoids } from "../app/lib/county-heat-map.ts";
import { COUNTY_HEAT_MAP_COLORS, countyHeatMapStops } from "../app/lib/heat-map-scale.ts";
import { exploreOpenApiDocument } from "../app/lib/explore-openapi.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("county heat-map comparison uses a same-state distance set and a five-step sequential scale", () => {
  const counties = [
    { geoid: "06001", stateFips: "06", internalPoint: { latitude: 37.6, longitude: -121.9 } },
    { geoid: "06013", stateFips: "06", internalPoint: { latitude: 37.9, longitude: -121.9 } },
    { geoid: "06075", stateFips: "06", internalPoint: { latitude: 37.76, longitude: -122.44 } },
    { geoid: "32031", stateFips: "32", internalPoint: { latitude: 40.7, longitude: -119.7 } },
  ];
  assert.deepEqual(nearestSameStateCountyGeoids(counties, "06001", 3), ["06001", "06013", "06075"]);
  assert.deepEqual(nearestSameStateCountyGeoids(counties, "99999", 3), []);
  const stops = countyHeatMapStops(10, 30);
  assert.equal(stops.length, 5);
  assert.deepEqual(stops.map((stop) => stop.color), [...COUNTY_HEAT_MAP_COLORS]);
  assert.deepEqual(stops.map((stop) => stop.value), [10, 15, 20, 25, 30]);
});

test("county heat-map distance wraps across the Alaska antimeridian", () => {
  const counties = [
    { geoid: "02016", stateFips: "02", internalPoint: { latitude: 51.95, longitude: 179.5 } },
    { geoid: "02013", stateFips: "02", internalPoint: { latitude: 55.1, longitude: -162.3 } },
    { geoid: "02130", stateFips: "02", internalPoint: { latitude: 55.3, longitude: -131.6 } },
  ];
  assert.deepEqual(nearestSameStateCountyGeoids(counties, "02016", 2), ["02016", "02013"]);
});

test("Explore visibly loads a standards-based county heat map with interaction and a table equivalent", async () => {
  const client = await read("app/explore/ExploreClient.tsx");
  const route = await read("app/api/evidence/v1/heat-map/route.ts");
  assert.match(client, /County evidence heat map/);
  assert.match(client, /comparisonGroup: "nearby"/);
  assert.match(client, /setDOMContent/);
  assert.match(client, /keyboard-accessible table follows the map/);
  assert.match(client, /role="table"/);
  assert.match(client, /Missing/);
  assert.ok(client.indexOf("<MultiCountyExplorer data={data}") < client.indexOf(`className={styles.visualGrid}`));
  assert.match(route, /nearestSameStateCountyGeoids/);
  assert.match(route, /not a peer ranking/);
  assert.match(route, /source: \{ publisher: source\.publisher/);
  assert.match(route, /value: observation\?\.value \?\? null/);
});

test("handoff and invitation routes reject invalid authority fields instead of weakening scope", async () => {
  const handoff = await read("app/api/evidence/v1/workspaces/[workspaceId]/handoff/route.ts");
  const invitation = await read("app/api/evidence/v1/workspaces/[workspaceId]/invitations/route.ts");
  assert.match(handoff, /typeof body\.targetRole !== "string" \|\| !roles\.has\(body\.targetRole\)/);
  assert.doesNotMatch(handoff, /: "community_partner"/);
  assert.match(handoff, /body\.targetPrincipalId !== undefined && !targetPrincipalId/);
  assert.match(invitation, /!intendedPrincipalId/);
  assert.match(invitation, /valid recipient identity/);
});

test("agent quota runs only after request validation and workspace authorization", async () => {
  const route = await read("app/api/evidence/v1/agent/route.ts");
  const validation = route.indexOf("if (!validInput(body))");
  const membership = route.indexOf("await requireWorkspaceMembership");
  const quota = route.indexOf("await enforceAgentRateLimit(request)");
  assert.ok(validation >= 0 && membership > validation && quota > membership);
});

test("PDF success audit hashes the rendered bytes and runs after rendering", async () => {
  const route = await read("app/api/evidence/v1/funder-snapshot/route.ts");
  const render = route.indexOf('const pdf = format === "pdf" ? await renderPdf(snapshot) : null');
  const audit = route.indexOf("await writeExecutionAudit", render);
  assert.ok(render >= 0 && audit > render);
  assert.match(route, /createHash\("sha256"\)\.update\(pdf\)/);
  assert.match(route, /Choose JSON or PDF format/);
});

test("workspace forks recover legacy retries, create an owner, and use the canonical root conflict target", async () => {
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  assert.match(runtime, /findLegacyWorkspaceFork/);
  assert.match(runtime, /source_event\.idempotency_key=\('workspace-forked:' \|\| target\.id::text\)/);
  assert.match(runtime, /const targetActor: WorkspaceActor = \{ \.\.\.input\.actor, access: "owner" \}/);
  assert.match(runtime, /ON CONFLICT \(tenant_id, geography_id\) WHERE status = 'active' AND parent_workspace_id IS NULL/);
});

test("OpenAPI documents funder representations and exact heat-map alternatives", () => {
  const funder = exploreOpenApiDocument.paths["/api/evidence/v1/funder-snapshot"];
  assert.ok(funder.get);
  assert.deepEqual(funder.get.parameters.map((item) => item.name), ["geoid", "format"]);
  assert.ok(funder.get.responses["200"].content["application/pdf"]);
  assert.deepEqual(exploreOpenApiDocument.components.schemas.CountySetRequest.properties.format.enum, ["json", "html"]);
  assert.ok(funder.post.responses["200"].content["text/html"]);
  assert.ok(funder.post.responses["200"].content["application/json"]);
  const heat = exploreOpenApiDocument.components.schemas.HeatMapCountySetRequest;
  assert.equal(heat.oneOf.length, 2);
  assert.equal(heat.oneOf[0].properties.geoids.maxItems, 1);
  assert.equal(heat.oneOf[0].properties.comparisonGroup.const, "nearby");
  assert.equal(heat.oneOf[0].properties.measureDefinitionId.type, "string");
  assert.equal(heat.oneOf[1].properties.geoids.minItems, 2);
  assert.equal(heat.oneOf[1].properties.measureDefinitionId.type, "string");
  assert.ok(!("comparisonGroup" in heat.oneOf[1].properties));
  const heatResponses = exploreOpenApiDocument.paths["/api/evidence/v1/heat-map"].post.responses;
  assert.ok(heatResponses["404"]);
  assert.ok(heatResponses["409"]);
});

test("OpenAPI matches voice and workspace creation response status codes", () => {
  const voiceResponses = exploreOpenApiDocument.paths["/api/evidence/v1/voice/transcribe"].post.responses;
  for (const status of ["403", "413", "422", "503"]) assert.ok(voiceResponses[status]);
  const workspaceResponses = exploreOpenApiDocument.paths["/api/evidence/v1/workspaces"].post.responses;
  assert.ok(workspaceResponses["201"]);
  assert.ok(!workspaceResponses["200"]);
  const shareResponses = exploreOpenApiDocument.paths["/api/evidence/v1/workspaces/{workspaceId}/share"].post.responses;
  assert.ok(shareResponses["201"]);
  assert.ok(!shareResponses["200"]);
});

test("national ACS provenance names the proportion MOE and its ratio fallback", async () => {
  const loader = await read("../../packages/evidence-core/scripts/load-national-context-data-api.ts");
  const labels = loader.match(/marginOfErrorFormula: "([^"]+)"/g) ?? [];
  assert.equal(labels.length, 3);
  for (const label of labels) {
    assert.match(label, /proportion MOE/);
    assert.match(label, /fallback when the proportion radicand is negative/);
  }
});

test("the complete national validator rebuilds when a prior dev server removed the production output", async () => {
  const source = await read("scripts/run-national-api-validation.mjs");
  assert.match(source, /access\(path\.join\(appDir, "\.next", "BUILD_ID"\)\)/);
  assert.match(source, /spawnSync\(process\.execPath, \[nextBin, "build"\]/);
  assert.match(source, /await ensureProductionBuild\(\)/);
});
