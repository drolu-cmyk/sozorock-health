import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { readBoundedBytes } from "../app/lib/request-security.ts";
import { normalizeHeatMapDomain } from "../app/lib/heat-map-scale.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("chunked multipart uploads are bounded before form parsing", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(6));
      controller.enqueue(new Uint8Array(6));
      controller.close();
    },
  });
  const request = new Request("https://health.sozorockfoundation.org/api/evidence/v1/voice/transcribe", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=voice" },
    body: stream,
    duplex: "half",
  });
  assert.deepEqual(await readBoundedBytes(request, 10, ["multipart/form-data"]), { ok: false, error: "too-large" });

  const route = await read("app/api/evidence/v1/voice/transcribe/route.ts");
  assert.match(route, /readBoundedBytes\(request, MAX_AUDIO_BYTES \+ 64_000/);
  assert.match(route, /new Request\(request\.url/);
  assert.doesNotMatch(route, /request\.formData\(\)/);
});

test("workspace agent writes require contributor access and workspace audit attribution follows authorization", async () => {
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  const suggestionStart = runtime.indexOf("export async function createWorkspaceAgentSuggestion");
  const suggestion = runtime.slice(suggestionStart, runtime.indexOf("export async function reviewWorkspaceAgentSuggestion", suggestionStart));
  assert.match(suggestion, /write: true/);

  const route = await read("app/api/evidence/v1/agent/route.ts");
  const authorization = route.indexOf("workspaceActor = await requireWorkspaceActor(request)");
  const auditAttribution = route.indexOf("auditWorkspaceId = body.workspaceId");
  const providerCall = route.indexOf("provider.generate");
  assert.ok(authorization >= 0 && authorization < auditAttribution && auditAttribution < providerCall);
  assert.match(route, /metadata: \{[\s\S]*workspaceId: auditWorkspaceId,[\s\S]*sectionKey: auditSectionKey/);
});

test("accepted agent suggestions use section locking and append immutable section history", async () => {
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  const reviewStart = runtime.indexOf("export async function reviewWorkspaceAgentSuggestion");
  const review = runtime.slice(reviewStart, runtime.indexOf("export async function createWorkspaceInvitation", reviewStart));
  assert.match(review, /pg_advisory_xact_lock/);
  assert.match(review, /workspace_section_version/);
  assert.match(review, /source_event_id/);
  assert.match(review, /expectedSectionVersion/);
  assert.match(review, /fromVersion: version, toVersion: version \+ 1/);
});

test("staging callback and every shipped Explore workspace are release-gated", async () => {
  const staging = await read("../../.github/workflows/milestone-10-staging.yml");
  const production = await read("../../.github/workflows/explore-production.yml");
  assert.match(staging, /--arg staging_url "\$staging_url"/);
  assert.match(staging, /PUBLIC_SITE_URL:\$staging_url/);
  for (const workflow of [staging, production]) {
    assert.match(workflow, /npm run verify:public-source-advisories/);
    assert.match(workflow, /npm run verify:public-runtime-security/);
    for (const workspace of ["@sozorock/evidence-core", "@sozorock/explore-realtime"]) {
      assert.match(workflow, new RegExp(`npm audit --workspace ${workspace.replace("/", "\\/")}`));
    }
  }
});

test("the Explore deployment role can provision only scoped Cognito domains and auth-cookie secrets", async () => {
  const policy = JSON.parse(await read("../../infrastructure/iam/github-explore-collaboration-policy.json"));
  const identity = policy.Statement.find((statement) => statement.Sid === "ProvisionExploreIdentity");
  const secrets = policy.Statement.find((statement) => statement.Sid === "ProvisionExploreAuthCookieSecrets");
  assert.ok(identity.Action.includes("cognito-idp:CreateUserPoolDomain"));
  assert.ok(identity.Action.includes("cognito-idp:DeleteUserPoolDomain"));
  assert.ok(identity.Action.includes("cognito-idp:DescribeUserPoolDomain"));
  assert.equal(secrets.Resource, "arn:aws:secretsmanager:us-east-1:791860731989:secret:/sozorock/explore/*/auth-cookie-*");
  assert.ok(secrets.Action.includes("secretsmanager:CreateSecret"));
  assert.ok(secrets.Action.includes("secretsmanager:DeleteSecret"));
});

test("Voice Access releases the recorder and microphone tracks when Action unmounts", async () => {
  const client = await read("app/explore/ExploreClient.tsx");
  const actionStart = client.indexOf("function ActionView");
  const action = client.slice(actionStart, client.indexOf("type HeatMapResult", actionStart));
  assert.match(action, /useEffect\(\(\) => \(\) => \{/);
  assert.match(action, /recorder\.ondataavailable = null/);
  assert.match(action, /recorder\.onstop = null/);
  assert.match(action, /recorder\.state !== "inactive"/);
  assert.match(action, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
});

test("release identity fails closed and constant heat-map domains remain renderable", async () => {
  const version = await read("app/api/health/version/route.ts");
  assert.match(version, /EVIDENCE_DATABASE_MIGRATION_VERSION\?\.trim\(\) \|\| "unavailable"/);
  assert.deepEqual(normalizeHeatMapDomain(22, 22), { minimum: 22, maximum: 23 });
  assert.deepEqual(normalizeHeatMapDomain(null, null), { minimum: 0, maximum: 1 });
  assert.deepEqual(normalizeHeatMapDomain(10, 14), { minimum: 10, maximum: 14 });
});
