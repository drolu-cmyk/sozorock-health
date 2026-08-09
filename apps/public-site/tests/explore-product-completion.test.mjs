import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(root, "../..");
const read = (value) => readFile(path.resolve(root, value), "utf8");

test("served OpenAPI covers every Explore workflow and matches committed generated output", async () => {
  const document = JSON.parse(await readFile(path.resolve(repo, "docs/explore/openapi.json"), "utf8"));
  const required = [
    "/api/evidence/v1/place-brief", "/api/explore", "/api/evidence/v1/agent",
    "/api/evidence/v1/voice/transcribe", "/api/evidence/v1/workspaces",
    "/api/evidence/v1/workspace-invitations/accept", "/api/evidence/v1/workspace-handoffs/accept",
    "/api/evidence/v1/workspace-share", "/api/evidence/v1/workspaces/{workspaceId}/scenarios",
    "/api/evidence/v1/workspaces/{workspaceId}/share", "/api/evidence/v1/workspaces/{workspaceId}/audit",
    "/api/evidence/v1/heat-map", "/api/evidence/v1/funder-snapshot", "/api/health/version",
  ];
  assert.equal(document.openapi, "3.1.0");
  required.forEach((route) => assert.ok(document.paths[route], route));
  assert.match(document["x-sozorock"].constraints, /No PHI/);
  assert.deepEqual(document.components.schemas.AgentRequest.required, ["geoid", "question"]);
});

test("Voice Access uses server transcription, explicit confirmation and the governed agent path", async () => {
  const route = await read("app/api/evidence/v1/voice/transcribe/route.ts");
  const client = await read("app/explore/ExploreClient.tsx");
  assert.match(route, /getOpenAIApiKey/);
  assert.match(route, /retainedRawAudio: false/);
  assert.doesNotMatch(route, /writeFile|putObject|S3/);
  assert.match(client, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(client, /Review or correct the transcript/);
  assert.match(client, /\/api\/evidence\/v1\/agent/);
  assert.match(client, /inputMode: transcriptHash/);
});

test("multi-county routes reject duplicates, preserve missingness and disclose county precision", async () => {
  const heat = await read("app/api/evidence/v1/heat-map/route.ts");
  const funder = await read("app/api/evidence/v1/funder-snapshot/route.ts");
  assert.match(heat, /new Set\(value\)\.size === value\.length/);
  assert.match(heat, /value: observation\?\.value \?\? null/);
  assert.match(heat, /does not imply ZIP, neighborhood, household or individual precision/);
  assert.match(funder, /status: "not_estimated"/);
  assert.match(funder, /One or more counties lack source-backed ACS population/);
  assert.doesNotMatch(funder, /population.*\?\? 0/);
});

test("Explore population is derived from the pinned brief ACS provenance", async () => {
  const route = await read("app/api/explore/route.ts");
  assert.match(route, /contextBySourceField\.get\(`census-acs5:\$\{field\}`\)/);
  assert.match(route, /population: contextNumber\("B01001_001E"\)/);
  assert.match(route, /population: acsContext\.population \?\? null/);
  assert.doesNotMatch(route, /population: record\.population/);
  assert.doesNotMatch(route, /getAcsCountyContext/);
});

test("authenticated workspace keeps viewer writes prohibited and agent acceptance human-only", async () => {
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  const artifacts = await read("app/api/evidence/v1/workspaces/[workspaceId]/artifacts/route.ts");
  const workspaceUi = await read("app/explore/workspaces/[workspaceId]/WorkspaceClient.tsx");
  assert.match(runtime, /access === "viewer"/);
  assert.match(runtime, /Agent suggestions require an authorized human decision/);
  assert.match(runtime, /enteredPlan: input\.decision === "accepted"/);
  assert.match(artifacts, /review_suggestion/);
  assert.match(workspaceUi, /setInterval/);
  assert.match(workspaceUi, /Accept into plan/);
  assert.match(workspaceUi, /readOnly=\{!writable\}/);
});

test("authenticated workspace infrastructure provides a PKCE login domain and server-only state secret", async () => {
  const auth = await read("app/lib/explore-workspace-auth.ts");
  const infrastructure = await readFile(path.resolve(repo, "infrastructure/cloudformation/explore-collaboration.yml"), "utf8");
  const production = await readFile(path.resolve(repo, ".github/workflows/explore-production.yml"), "utf8");
  const staging = await readFile(path.resolve(repo, ".github/workflows/milestone-10-staging.yml"), "utf8");
  assert.match(auth, /EXPLORE_COGNITO_DOMAIN/);
  assert.match(auth, /EXPLORE_AUTH_COOKIE_SECRET_ARN/);
  assert.match(infrastructure, /AWS::Cognito::UserPoolDomain/);
  assert.match(infrastructure, /AllowedOAuthFlowsUserPoolClient: true/);
  assert.match(infrastructure, /AWS::SecretsManager::Secret/);
  assert.match(infrastructure, /secretsmanager:GetSecretValue/);
  for (const workflow of [production, staging]) {
    assert.match(workflow, /EXPLORE_COGNITO_DOMAIN/);
    assert.match(workflow, /EXPLORE_COGNITO_CLIENT_ID/);
    assert.match(workflow, /EXPLORE_AUTH_COOKIE_SECRET_ARN/);
  }
});

test("workspace owners can revoke expiring shares and authorized reviewers can inspect append-only audits", async () => {
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  const shareRoute = await read("app/api/evidence/v1/workspaces/[workspaceId]/share/route.ts");
  const auditRoute = await read("app/api/evidence/v1/workspaces/[workspaceId]/audit/route.ts");
  const workspaceUi = await read("app/explore/workspaces/[workspaceId]/WorkspaceClient.tsx");
  assert.match(runtime, /revokeWorkspaceShareLink/);
  assert.match(runtime, /revoked_at=now\(\)/);
  assert.match(runtime, /allowedAccess: \["owner"\], allowedRoles: \["foundation_reviewer"\]/);
  assert.match(shareRoute, /export async function DELETE/);
  assert.match(shareRoute, /Cache-Control": "no-store"/);
  assert.match(auditRoute, /getWorkspaceAudit/);
  assert.match(auditRoute, /Cache-Control": "private, no-store"/);
  assert.match(workspaceUi, /Create 72-hour public read-only link/);
  assert.match(workspaceUi, /Compliance audit/);
});

test("release identity contains commit, snapshot, migration, policy and OpenAPI versions", async () => {
  const version = await read("app/api/health/version/route.ts");
  for (const name of ["repositoryCommitSha", "buildTimestamp", "evidenceSnapshotContentHash", "databaseMigrationVersion", "policyVersion", "openApiVersion"]) assert.match(version, new RegExp(name));
});
