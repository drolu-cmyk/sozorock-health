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
const workspaceRoutePaths = [
  "../app/api/evidence/v1/workspaces/[workspaceId]/route.ts",
  "../app/api/evidence/v1/workspaces/[workspaceId]/events/route.ts",
  "../app/api/evidence/v1/workspaces/[workspaceId]/fork/route.ts",
  "../app/api/evidence/v1/workspaces/[workspaceId]/handoff/route.ts",
  "../app/api/evidence/v1/workspaces/[workspaceId]/invitations/route.ts",
  "../app/api/evidence/v1/workspaces/[workspaceId]/realtime-session/route.ts",
  "../app/api/evidence/v1/workspaces/[workspaceId]/realtime-session/handoff/route.ts",
  "../app/api/evidence/v1/workspaces/[workspaceId]/realtime-session/handoff/accept/route.ts",
  "../app/api/evidence/v1/workspaces/[workspaceId]/scenarios/route.ts",
  "../app/api/evidence/v1/workspaces/[workspaceId]/sections/[sectionKey]/route.ts",
  "../app/api/evidence/v1/workspaces/[workspaceId]/share/route.ts",
];
const workspaceRoutes = await Promise.all(
  workspaceRoutePaths.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
);
const workspaceShareCreateRoute = workspaceRoutes.at(-1);
const shareClient = await readFile(
  new URL("../app/explore/share/ShareWorkspaceClient.tsx", import.meta.url),
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
const advancedMigration = await readFile(
  new URL("../../../packages/evidence-core/migrations/0009_explore_agentic_operations.sql", import.meta.url),
  "utf8",
);
const publicShareMigration = await readFile(
  new URL("../../../packages/evidence-core/migrations/0013_public_review_questions.sql", import.meta.url),
  "utf8",
);
const realtimeHandoff = await readFile(
  new URL("../app/api/evidence/v1/workspaces/[workspaceId]/realtime-session/handoff/route.ts", import.meta.url),
  "utf8",
);
const realtimeHandoffAccept = await readFile(
  new URL("../app/api/evidence/v1/workspaces/[workspaceId]/realtime-session/handoff/accept/route.ts", import.meta.url),
  "utf8",
);
const publicBuildSpec = await readFile(
  new URL("../../../infrastructure/amplify/public-site.yml", import.meta.url),
  "utf8",
);
const shareRoute = await readFile(
  new URL("../app/api/evidence/v1/workspace-share/route.ts", import.meta.url),
  "utf8",
);
const onboardingRoute = await readFile(
  new URL("../app/api/evidence/v1/onboarding/route.ts", import.meta.url),
  "utf8",
);
const telemetryRoute = await readFile(
  new URL("../app/api/evidence/v1/telemetry/route.ts", import.meta.url),
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
  assert.match(runtime, /DO NOTHING/);
  assert.doesNotMatch(runtime, /DO UPDATE SET idempotency_key/);
  assert.match(runtime, /authority='census'/);
  assert.doesNotMatch(runtime, /authority='US_CENSUS'/);
  assert.match(runtime, /role !== input\.actor\.role/);
  assert.match(runtime, /access !== input\.actor\.access/);
});

test("real-time session is opaque, short-lived and never authorizes mutations", () => {
  assert.match(realtime, /randomBytes\(32\)/);
  assert.match(realtime, /Math\.floor\(Date\.now\(\) \/ 1000\) \+ 300/);
  assert.match(realtime, /sozorock-session\./);
  assert.match(realtime, /EXPLORE_REALTIME_PUBLIC_ENDPOINT/);
  assert.doesNotMatch(realtime, /NEXT_PUBLIC_EXPLORE_REALTIME_ENDPOINT/);
  assert.doesNotMatch(realtime, /OPENAI_API_KEY|CENSUS_API_KEY|secretValue/i);
  assert.match(realtimeHandler, /Workspace writes use the authenticated HTTPS API/);
  assert.match(realtimeHandler, /item\.kind\?\.S !== "session"/);
  assert.match(realtimeHandler, /ConditionExpression: "kind = :kind AND expires_at > :now"/);
  assert.match(realtime, /kind: \{ S: "handoff" \}/);
  assert.match(realtime, /ConditionExpression: "attribute_not_exists\(used\) OR used = :notUsed"/);
  assert.match(realtimeHandoff, /mintRealtimeHandoff/);
  assert.match(realtimeHandoffAccept, /acceptRealtimeHandoff/);
  assert.match(realtimeHandoffAccept, /requireWorkspaceMembership/);
  assert.match(infrastructure, /ThrottlingBurstLimit:\s*100/);
  assert.match(infrastructure, /TimeToLiveSpecification/);
  assert.match(infrastructure, /dynamodb:GetItem/);
  assert.match(infrastructure, /dynamodb:UpdateItem/);
});

test("Amplify exposes only approved server configuration to the Next.js runtime", () => {
  assert.match(publicBuildSpec, /> apps\/public-site\/\.env\.production/);
  assert.match(publicBuildSpec, /EXPLORE_REALTIME_/);
  assert.match(publicBuildSpec, /OPENAI_PLACE_EVIDENCE_/);
  assert.doesNotMatch(publicBuildSpec, /NEXT_PUBLIC_EXPLORE_REALTIME_/);
  assert.doesNotMatch(publicBuildSpec, /OPENAI_API_KEY|CENSUS_API_KEY/);
});

test("workspace event route enforces same-origin, authentication and human-only review", () => {
  assert.match(eventRoute, /isTrustedSameOrigin/);
  assert.match(eventRoute, /requireWorkspaceActor/);
  assert.match(eventRoute, /clientActivityEventTypes/);
  assert.match(eventRoute, /enforceWorkspaceEventRateLimit/);
  assert.doesNotMatch(eventRoute, /eventRequiresHumanAcceptance/);
  assert.doesNotMatch(eventRoute, /Access-Control-Allow-Origin/);
  assert.match(shareRoute, /getSharedWorkspacePlan/);
  assert.doesNotMatch(shareRoute, /tenantId/);
  assert.match(onboardingRoute, /evidenceRuntimeEnvironment\(\)/);
  assert.doesNotMatch(onboardingRoute, /body\.environment/);
  assert.match(telemetryRoute, /evidenceRuntimeEnvironment\(\)/);
  assert.doesNotMatch(telemetryRoute, /body\.environment/);
  assert.match(telemetryRoute, /Performance telemetry is server-generated/);
});

test("workspace share capabilities leave the URL before server reads", () => {
  assert.ok(workspaceShareCreateRoute);
  assert.match(workspaceShareCreateRoute, /\/explore\/share#token=/);
  assert.match(workspaceShareCreateRoute, /const \{ token, \.\.\.publicShare \} = share/);
  assert.doesNotMatch(workspaceShareCreateRoute, /share:\s*share\b/);
  assert.match(shareClient, /window\.location\.hash/);
  assert.match(shareClient, /window\.history\.replaceState/);
  assert.match(shareRoute, /httpOnly:\s*true/);
  assert.match(shareRoute, /sameSite:\s*"lax"/);
  assert.match(shareRoute, /Referrer-Policy/);
  assert.doesNotMatch(shareRoute, /nextUrl\.searchParams/);
});

test("workspace APIs do not return raw caught error messages", () => {
  for (const route of workspaceRoutes) {
    assert.doesNotMatch(route, /\{\s*error:\s*\(error as Error\)\.message\s*\}/);
    assert.doesNotMatch(route, /\{\s*error:\s*message\s*\}/);
  }
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
  for (const trigger of [
    "explore_usage_event_append_only",
    "explore_performance_sample_append_only",
    "source_change_proposal_append_only",
  ]) {
    assert.match(advancedMigration, new RegExp(trigger));
  }
  assert.match(advancedMigration, /workspace_share_link/);
  assert.match(advancedMigration, /explore_onboarding_request/);
  assert.match(advancedMigration, /workspace_handoff/);
});

test("public review questions require an explicit public flag", () => {
  assert.match(publicShareMigration, /is_public boolean NOT NULL DEFAULT false/);
  assert.match(publicShareMigration, /workspace_review_question_public_idx/);
});
