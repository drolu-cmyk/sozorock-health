import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { exploreOpenApiDocument } from "../app/lib/explore-openapi.ts";

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

test("served OpenAPI declares every path variable and heat maps require multiple counties", () => {
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
  assert.equal(exploreOpenApiDocument.components.schemas.HeatMapCountySetRequest.properties.geoids.minItems, 2);
  assert.equal(exploreOpenApiDocument.paths["/api/evidence/v1/heat-map"].post.requestBody.content["application/json"].schema.$ref, "#/components/schemas/HeatMapCountySetRequest");
  const scenarioResponses = exploreOpenApiDocument.paths["/api/evidence/v1/workspaces/{workspaceId}/scenarios"].post.responses;
  assert.ok("201" in scenarioResponses);
  assert.ok(!("200" in scenarioResponses));
});
