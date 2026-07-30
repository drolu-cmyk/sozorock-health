import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const auth = await readFile(new URL("../app/lib/explore-workspace-auth.ts", import.meta.url), "utf8");
const runtime = await readFile(new URL("../app/lib/explore-workspace-runtime.ts", import.meta.url), "utf8");
const realtime = await readFile(new URL("../app/lib/explore-realtime.ts", import.meta.url), "utf8");
const eventRoute = await readFile(
  new URL("../app/api/evidence/v1/workspaces/[workspaceId]/events/route.ts", import.meta.url),
  "utf8",
);
const infrastructure = await readFile(
  new URL("../../../infrastructure/cloudformation/explore-collaboration.yml", import.meta.url),
  "utf8",
);
const realtimeHandler = await readFile(
  new URL("../../../packages/explore-realtime/src/handler.ts", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL("../../../packages/evidence-core/migrations/0008_explore_agentic_collaboration.sql", import.meta.url),
  "utf8",
);

test("workspace authentication is Cognito-backed and tenant scoped", () => {
  assert.match(auth, /GetUserCommand/);
  assert.match(auth, /custom:tenant_id/);
  assert.match(auth, /custom:workspace_role/);
  assert.match(runtime, /w\.tenant_id=CAST\(:tenant_id AS uuid\)/);
  assert.match(runtime, /p\.principal_id=:principal_id/);
  assert.match(runtime, /pg_advisory_xact_lock/);
  assert.match(runtime, /ON CONFLICT \(workspace_id, idempotency_key\)/);
  assert.match(runtime, /authority='census'/);
  assert.doesNotMatch(runtime, /authority='US_CENSUS'/);
});

test("real-time session is opaque, short-lived and never authorizes mutations", () => {
  assert.match(realtime, /randomBytes\(32\)/);
  assert.match(realtime, /Math\.floor\(Date\.now\(\) \/ 1000\) \+ 300/);
  assert.match(realtime, /sozorock-session\./);
  assert.match(realtime, /EXPLORE_REALTIME_PUBLIC_ENDPOINT/);
  assert.doesNotMatch(realtime, /NEXT_PUBLIC_EXPLORE_REALTIME_ENDPOINT/);
  assert.doesNotMatch(realtime, /OPENAI_API_KEY|CENSUS_API_KEY|secretValue/i);
  assert.match(realtimeHandler, /Workspace writes use the authenticated HTTPS API/);
  assert.match(infrastructure, /ThrottlingBurstLimit:\s*100/);
  assert.match(infrastructure, /TimeToLiveSpecification/);
});

test("workspace event route enforces same-origin, authentication and human-only review", () => {
  assert.match(eventRoute, /isTrustedSameOrigin/);
  assert.match(eventRoute, /requireWorkspaceActor/);
  assert.match(eventRoute, /eventRequiresHumanAcceptance/);
  assert.match(eventRoute, /This action requires an authorized human participant/);
  assert.doesNotMatch(eventRoute, /Access-Control-Allow-Origin/);
});

test("collaboration records that carry history are immutable", () => {
  for (const trigger of [
    "workspace_event_append_only",
    "workspace_section_version_append_only",
    "planning_scenario_version_append_only",
    "funder_snapshot_append_only",
    "source_adapter_execution_append_only",
  ]) {
    assert.match(migration, new RegExp(trigger));
  }
});
