import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("production Explore evidence reads the persistent Evidence Core and keeps the fixture test-only", async () => {
  const runtime = await source("app/lib/published-evidence-runtime.ts");
  assert.match(runtime, /evidenceRuntimeEnvironment\(\) === "test"/);
  assert.match(runtime, /executeEvidenceSql/);
  assert.match(runtime, /evidence\.metric_observation/);
  assert.match(runtime, /evidence\.source_coverage/);
  assert.match(runtime, /evidence\.geography/);
  assert.match(runtime, /evidence\.evidence_snapshot/);
  assert.match(runtime, /snapshot_source_version/);
  assert.match(runtime, /context_source_/);
  assert.match(runtime, /getPublishedWorkforceContext/);
});

test("Explore routes do not resolve county evidence through the bundled fixture", async () => {
  const route = await source("app/api/explore/route.ts");
  const briefRoute = await source("app/api/evidence/v1/place-brief/route.ts");
  const agent = await source("app/lib/place-agent-openai.ts");
  assert.doesNotMatch(route, /getApprovedCountyBrief|countyRecordByFips/);
  assert.doesNotMatch(briefRoute, /getApprovedCountyBrief/);
  assert.doesNotMatch(agent, /getApprovedCountyBrief|countyRecordByFips/);
  assert.match(agent, /getPublishedCountyBriefByIdentifier/);
});

test("runtime measure mapping keeps COPD keyed by the canonical source measure", async () => {
  const runtime = await source("app/lib/published-evidence-runtime.ts");
  assert.match(runtime, /COPD:\s*\{\s*group:\s*"conditions",\s*field:\s*"copd"/);
  assert.match(runtime, /source_measure_id/);
});
