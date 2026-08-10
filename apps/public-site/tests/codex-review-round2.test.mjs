import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { exploreOpenApiDocument } from "../app/lib/explore-openapi.ts";
import { canonicalJsonStringify, sha256 } from "../app/lib/evidence-runtime-authority.ts";
import { buildMetricComparison } from "../app/lib/explore-comparisons.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("workspace suggestions are section-idempotent and success is recorded only after persistence", async () => {
  const route = await read("app/api/evidence/v1/agent/route.ts");
  assert.match(route, /workspaceId: body\.workspaceId \?\? null/);
  assert.match(route, /sectionKey: body\.workspaceId \? body\.sectionKey \?\? "plan" : null/);
  const suggestion = route.indexOf("workspaceSuggestion = await createWorkspaceAgentSuggestion");
  const succeededAudit = route.indexOf("outcome: output.answer.status === \"refused\" ? \"rejected\" : \"succeeded\"");
  const successSample = route.indexOf('operation: "agent_response"', succeededAudit);
  assert.ok(suggestion >= 0 && suggestion < succeededAudit && succeededAudit < successSample);
});

test("workspace controls use membership access and a contributor can create the first section", async () => {
  const client = await read("app/explore/workspaces/[workspaceId]/WorkspaceClient.tsx");
  assert.match(client, /plan\.participants\.find\(\(participant\) => participant\.principalId === plan\.actor\.principalId\)/);
  assert.match(client, /workspaceAccess === "owner" \|\| workspaceAccess === "contributor"/);
  assert.match(client, /defaultSection: Section = \{ sectionKey: "plan", version: 0/);
  assert.match(client, /writable \? <SectionEditor section=\{defaultSection\} writable/);
  assert.doesNotMatch(client, /const writable = plan\.actor\.access/);
});

test("owner-only workspace mutations use the workspace membership rather than account-wide access", async () => {
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  assert.match(runtime, /allowedAccess\?: WorkspaceAccess\[\]/);
  for (const exported of ["createWorkspaceInvitation", "createWorkspaceShareLink", "listWorkspaceShareLinks", "revokeWorkspaceShareLink"]) {
    const start = runtime.indexOf(`export async function ${exported}`);
    assert.ok(start >= 0, `${exported} exists`);
    const next = runtime.indexOf("export async function", start + 20);
    const body = runtime.slice(start, next < 0 ? undefined : next);
    assert.match(body, /allowedAccess: \["owner"\]/, `${exported} requires owner membership`);
  }
  const auditStart = runtime.indexOf("export async function getWorkspaceAudit");
  const audit = runtime.slice(auditStart, runtime.indexOf("export async function", auditStart + 20));
  assert.match(audit, /allowedAccess: \["owner"\], allowedRoles: \["foundation_reviewer"\]/);
});

test("workspace forks can coexist, authorize the target event, and recover idempotently", async () => {
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  const migration = await read("../../packages/evidence-core/migrations/0016_workspace_forks_and_version_metadata.sql");
  assert.match(migration, /parent_workspace_id IS NULL/);
  assert.match(migration, /county_workspace_active_fork_idx/);
  const start = runtime.indexOf("export async function forkCountyWorkspace");
  const fork = runtime.slice(start, runtime.indexOf("export async function recordExploreUsage", start));
  assert.match(fork, /findWorkspaceMutationEvent/);
  assert.ok(fork.indexOf("findWorkspaceMutationEvent") < fork.indexOf("INSERT INTO evidence.county_workspace"));
  const membershipInsert = fork.indexOf("INSERT INTO evidence.workspace_participant");
  const targetEvent = fork.indexOf("const targetEvent = await appendWorkspaceEvent");
  assert.ok(membershipInsert >= 0 && membershipInsert < targetEvent);
  assert.match(fork, /eventType: "workspace_forked"[\s\S]*idempotencyKey: input\.idempotencyKey/);
  assert.match(fork, /requestHash/);
});

test("accepted plan edits advance parent workspace version metadata", async () => {
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  const updates = runtime.match(/UPDATE evidence\.county_workspace\s+SET version=version \+ 1, updated_at=now\(\)/g) ?? [];
  assert.ok(updates.length >= 2, "section saves and accepted suggestions advance workspace metadata");
});

test("workforce citations are valid structured agent evidence", async () => {
  const provider = await read("app/lib/place-agent-openai.ts");
  assert.match(provider, /"planning_status" \| "workforce_designation"/);
  assert.match(provider, /"source_coverage", "planning_status", "workforce_designation"/);
});

test("voice transcription has a separate bounded quota from generated answers", async () => {
  const route = await read("app/api/evidence/v1/voice/transcribe/route.ts");
  const limiter = await read("app/lib/evidence-rate-limit.ts");
  assert.match(route, /enforceVoiceTranscriptionRateLimit/);
  assert.doesNotMatch(route, /enforceAgentRateLimit/);
  assert.match(limiter, /voice-transcription-global#/);
  assert.match(limiter, /voice-transcription-rate#/);
  assert.match(limiter, /VOICE_TRANSCRIPTION_MAX_PER_NETWORK_HOUR/);
  assert.match(limiter, /new TransactWriteCommand/);
  assert.match(limiter, /return enforceAtomicDualQuota\(\{[\s\S]*voice-transcription-global#[\s\S]*voice-transcription-rate#/);
  assert.match(limiter, /CancellationReasons\?\.some\(\(reason\) => reason\.Code === "ConditionalCheckFailed"\)/);
  assert.doesNotMatch(limiter, /\["ConditionalCheckFailedException", "TransactionCanceledException"\]\.includes/);
});

test("the Explore runtime role can enforce atomic quotas on the configured rate-limit table", async () => {
  const infrastructure = await read("../../infrastructure/cloudformation/explore-collaboration.yml");
  const staging = await read("../../.github/workflows/milestone-10-staging.yml");
  const production = await read("../../.github/workflows/explore-production.yml");
  assert.match(infrastructure, /PublicRateLimitTableArn/);
  assert.match(infrastructure, /dynamodb:TransactWriteItems/);
  for (const workflow of [staging, production]) {
    assert.match(workflow, /ContactTableName/);
    assert.match(workflow, /aws dynamodb describe-table/);
    assert.match(workflow, /PublicRateLimitTableArn="\$PUBLIC_RATE_LIMIT_TABLE_ARN"/);
  }
});

test("malformed suggestion review decisions fail before any workspace mutation", async () => {
  const route = await read("app/api/evidence/v1/workspaces/[workspaceId]/artifacts/route.ts");
  const validation = route.indexOf('body.decision !== "accepted" && body.decision !== "rejected"');
  const mutation = route.indexOf("reviewWorkspaceAgentSuggestion({");
  assert.ok(validation >= 0 && validation < mutation);
  assert.match(route, /Suggestion review decision is invalid/);
  assert.doesNotMatch(route, /body\.decision === "accepted" \? "accepted" : "rejected"/);
});

test("a committed workspace suggestion is not reported as failed when the success audit is unavailable", async () => {
  const route = await read("app/api/evidence/v1/agent/route.ts");
  assert.match(route, /if \(!workspaceSuggestion\) throw error/);
  assert.match(route, /place-evidence-agent-success-audit-failed/);
});

test("scenario review appends an immutable version instead of updating history", async () => {
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  const start = runtime.indexOf("export async function reviewPlanningScenario");
  const review = runtime.slice(start, runtime.indexOf("async function loadWorkspacePlan", start));
  assert.match(review, /INSERT INTO evidence\.planning_scenario_version/);
  assert.match(review, /reviewedVersion = version \+ 1/);
  assert.match(review, /current_version=:reviewed_version/);
  assert.match(review, /idempotency_key=:idempotency_key[\s\S]*FOR UPDATE/);
  assert.ok(review.indexOf("pg_advisory_xact_lock") < review.indexOf("idempotency_key=:idempotency_key"));
  assert.ok(review.indexOf("idempotency_key=:idempotency_key") < review.indexOf("INSERT INTO evidence.planning_scenario_version"));
  assert.match(review, /jsonb_set\(outputs, '\{humanReviewStatus\}', to_jsonb\(CAST\(:decision AS text\)\), true\)/);
  assert.match(review, /idempotency key is already bound to a different workspace mutation/);
  assert.doesNotMatch(review, /UPDATE evidence\.planning_scenario_version/);
});

test("scenario creation recovers the original result before inserting on retry", async () => {
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  const start = runtime.indexOf("export async function createPlanningScenario");
  const creation = runtime.slice(start, runtime.indexOf("export async function reviewPlanningScenario", start));
  const recovery = creation.indexOf("idempotency_key=:idempotency_key");
  const insert = creation.indexOf("INSERT INTO evidence.planning_scenario (");
  assert.ok(recovery >= 0 && recovery < insert);
  assert.match(creation, /eventType !== "scenario_created"/);
  assert.match(creation, /persistedRequestHash = sha256\([\s\S]*scenarioInputs: priorOutput\.inputs/);
  assert.match(creation, /persistedRequestHash !== scenarioRequestHash/);
  assert.match(creation, /requestHash: scenarioRequestHash/);
  assert.match(creation, /idempotent scenario version could not be recovered/);
});

test("legacy scenario retries use canonical hashes after PostgreSQL jsonb reorders keys", () => {
  const submitted = {
    name: "Two-county comparison",
    scenarioInputs: {
      selectedCountyGeoids: ["17031", "06075"],
      hubLocations: 2,
      eventFrequencyPerYear: 4,
      partnerCapacityPerEvent: 45,
    },
    evidenceUsed: ["acs:population", "hrsa:hpsa"],
    evidenceMissing: ["verified local plan"],
  };
  const persistedJsonbOrder = {
    evidenceMissing: ["verified local plan"],
    evidenceUsed: ["acs:population", "hrsa:hpsa"],
    scenarioInputs: {
      partnerCapacityPerEvent: 45,
      eventFrequencyPerYear: 4,
      hubLocations: 2,
      selectedCountyGeoids: ["17031", "06075"],
    },
    name: "Two-county comparison",
  };
  assert.equal(canonicalJsonStringify(submitted), canonicalJsonStringify(persistedJsonbOrder));
  assert.equal(sha256(submitted), sha256(persistedJsonbOrder));
});

test("scenario retries reconstruct canonical semantics instead of trusting legacy hash bytes", async () => {
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  const start = runtime.indexOf("export async function createPlanningScenario");
  const creation = runtime.slice(start, runtime.indexOf("export async function reviewPlanningScenario", start));
  assert.match(creation, /JOIN evidence\.planning_scenario s ON s\.id=v\.scenario_id/);
  assert.match(creation, /persistedRequestHash = sha256/);
  assert.match(creation, /persistedRequestHash !== scenarioRequestHash/);
  assert.doesNotMatch(creation, /typeof payload\.requestHash === "string"\s*\? payload\.requestHash/);
});

test("workspace artifacts recover committed idempotent writes and review questions can complete", async () => {
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  const route = await read("app/api/evidence/v1/workspaces/[workspaceId]/artifacts/route.ts");
  for (const exported of ["addWorkspaceComment", "addWorkspaceReviewQuestion", "createWorkspaceAgentSuggestion"]) {
    const start = runtime.indexOf(`export async function ${exported}`);
    assert.ok(start >= 0, `${exported} exists`);
    const next = runtime.indexOf("export async function", start + 20);
    const body = runtime.slice(start, next < 0 ? undefined : next);
    assert.match(body, /findWorkspaceMutationEvent/);
    assert.ok(body.indexOf("findWorkspaceMutationEvent") < body.indexOf("INSERT INTO evidence."));
  }
  assert.match(runtime, /export async function completeWorkspaceReviewQuestion/);
  assert.match(runtime, /SET status=:status, completed_at=now\(\)/);
  assert.match(route, /action === "complete_review_question"/);
  assert.match(route, /body\.status !== "answered" && body\.status !== "closed"/);
});

test("workspace forms retain a stable form reference across awaited requests", async () => {
  const client = await read("app/explore/workspaces/[workspaceId]/WorkspaceClient.tsx");
  assert.match(client, /const formElement = event\.currentTarget;/);
  assert.match(client, /formElement\.reset\(\)/);
  assert.doesNotMatch(client, /event\.currentTarget\.reset\(\)/);
  assert.match(client, /completeReviewQuestion/);
  assert.match(client, /Mark answered/);
});

test("zero and negative-zero benchmark differences are described as equal after rounding", () => {
  for (const localValue of [60.2, 60.24, 60.16]) {
    const result = buildMetricComparison({
      localValue,
      benchmarkValue: 60.2,
      basis: "state",
      higherValueMeaning: "adverse",
    });
    assert.equal(result.difference, 0);
    assert.equal(result.interpretation, "equal");
    assert.equal(result.sentence, "No percentage-point difference from the state comparison after rounding.");
  }
});

test("public share links are explicitly read-only until a governed write path exists", async () => {
  const route = await read("app/api/evidence/v1/workspaces/[workspaceId]/share/route.ts");
  const runtime = await read("app/lib/explore-workspace-runtime.ts");
  assert.match(route, /body\.scope !== undefined && body\.scope !== "read_only"/);
  assert.match(route, /Only read-only public share links are supported/);
  assert.match(runtime, /scope: "read_only";/);
  assert.match(runtime, /l\.scope='read_only'/);
  const shareRequest = exploreOpenApiDocument.paths["/api/evidence/v1/workspaces/{workspaceId}/share"].post.requestBody.content["application/json"].schema;
  assert.deepEqual(shareRequest.properties.scope.enum, ["read_only"]);
});

test("served OpenAPI declares every path variable and heat maps require a valid comparison set", () => {
  for (const [path, pathItem] of Object.entries(exploreOpenApiDocument.paths)) {
    const variables = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    if (!variables.length) continue;
    const pathParameters = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
    for (const operation of Object.values(pathItem)) {
      if (!operation || typeof operation !== "object" || Array.isArray(operation)) continue;
      if (!("responses" in operation)) continue;
      const parameters = [...pathParameters, ...(Array.isArray(operation.parameters) ? operation.parameters : [])];
      for (const variable of variables) {
        assert.ok(parameters.some((parameter) => parameter.name === variable && parameter.in === "path" && parameter.required === true), `${path} is missing ${variable}`);
      }
    }
  }
  assert.equal(exploreOpenApiDocument.components.schemas.CountySetRequest.properties.geoids.minItems, 1);
  assert.equal(exploreOpenApiDocument.components.schemas.HeatMapCountySetRequest.properties.geoids.minItems, 1);
  assert.deepEqual(exploreOpenApiDocument.components.schemas.HeatMapCountySetRequest.properties.comparisonGroup.enum, ["nearby", null]);
  assert.equal(exploreOpenApiDocument.paths["/api/evidence/v1/heat-map"].post.requestBody.content["application/json"].schema.$ref, "#/components/schemas/HeatMapCountySetRequest");
  const scenarioResponses = exploreOpenApiDocument.paths["/api/evidence/v1/workspaces/{workspaceId}/scenarios"].post.responses;
  assert.ok("201" in scenarioResponses);
  assert.ok(!("200" in scenarioResponses));
  const artifactOperation = exploreOpenApiDocument.paths["/api/evidence/v1/workspaces/{workspaceId}/artifacts"].post;
  assert.equal(artifactOperation.responses["201"].description, "Successful response.");
  assert.ok(artifactOperation.requestBody.content["application/json"].schema.oneOf.some((schema) => schema.properties.action.const === "complete_review_question"));
});
