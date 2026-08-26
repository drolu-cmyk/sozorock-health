import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isClinicalSafetyQuestion } from "../app/lib/place-agent-safety.ts";
import { agentRateLimitNamespace } from "../app/lib/agent-rate-limit-policy.ts";

const provider = await readFile(new URL("../app/lib/place-agent-openai.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/evidence/v1/agent/route.ts", import.meta.url), "utf8");
const workflow = await readFile(new URL("../../../.github/workflows/explore-production.yml", import.meta.url), "utf8");
const stagingWorkflow = await readFile(
  new URL("../../../.github/workflows/milestone-10-staging.yml", import.meta.url),
  "utf8",
);
const evidenceInfrastructure = await readFile(
  new URL("../../../infrastructure/cloudformation/evidence-core.yml", import.meta.url),
  "utf8",
);
const runtimeRoleMigration = await readFile(
  new URL("../../../packages/evidence-core/migrations/0016_least_privileged_runtime.sql", import.meta.url),
  "utf8",
);
const nextConfig = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
const amplifyBuild = await readFile(
  new URL("../../../infrastructure/amplify/public-site.yml", import.meta.url),
  "utf8",
);
const runtimeVerifier = await readFile(new URL("../../../scripts/verify-public-runtime-security.mjs", import.meta.url), "utf8");
const runtimeAuthority = await readFile(new URL("../app/lib/evidence-runtime-authority.ts", import.meta.url), "utf8");
const evidenceRateLimit = await readFile(new URL("../app/lib/evidence-rate-limit.ts", import.meta.url), "utf8");
const exploreRoute = await readFile(new URL("../app/api/explore/route.ts", import.meta.url), "utf8");
const placeBriefRoute = await readFile(new URL("../app/api/evidence/v1/place-brief/route.ts", import.meta.url), "utf8");
const packageLock = JSON.parse(await readFile(new URL("../../../package-lock.json", import.meta.url), "utf8"));

test("production agent is evidence-only, stored-output disabled, bounded, and tool allowlisted", () => {
  assert.match(provider, /store:\s*false/);
  assert.match(provider, /PLACE_AGENT_TOOL_DEFINITIONS/);
  assert.match(provider, /MAX_TOOL_DEPTH\s*=\s*3/);
  assert.match(provider, /MAX_OUTPUT_TOKENS\s*=\s*900/);
  assert.match(provider, /Return no more than three citedEvidence items/);
  assert.match(provider, /OPENAI_PLACE_EVIDENCE_SECRET_ARN/);
  assert.match(provider, /max_tool_calls:\s*MAX_TOOL_DEPTH/);
  assert.match(provider, /parallel_tool_calls:\s*false/);
  assert.match(provider, /reasoning:\s*\{\s*effort:\s*"none"\s*\}/);
  assert.match(provider, /verbosity:\s*"low"/);
  assert.match(provider, /REQUEST_TIMEOUT_MS\s*=\s*22_000/);
  assert.match(provider, /place-agent-pipeline\.v1/);
  for (const step of [
    "resolve_geography",
    "resolve_county_relationships",
    "get_place_evidence",
    "get_source_coverage",
    "list_verified_local_plans",
    "get_map_layers",
    "compare_compatible_measures",
    "identify_evidence_gaps",
    "evaluate_response_fit",
    "validate_claims_and_citations",
    "generate_structured_visual_result",
  ]) {
    assert.match(provider, new RegExp(`"${step}"`));
  }
  assert.doesNotMatch(provider, /web_search|computer_use|file_search|https?:\/\/(?!api\.openai\.com)/);
});

test("unsupported claims and clinical questions fail closed", () => {
  assert.match(provider, /claim does not exactly match the approved evidence package/);
  assert.match(provider, /cannot provide medical advice/);
  assert.equal(isClinicalSafetyQuestion("Please diagnose my symptoms."), true);
  assert.equal(isClinicalSafetyQuestion("What medication dosage should I take?"), true);
  assert.equal(isClinicalSafetyQuestion("Prescribe treatment for my diagnosis."), true);
  assert.equal(isClinicalSafetyQuestion("What does the reviewed county evidence show?"), false);
  assert.match(provider, /evidence_gap/);
});

test("public agent route requires origin, bounded JSON, rate limit, authority, and immutable audit", () => {
  assert.match(route, /isTrustedSameOrigin/);
  assert.match(route, /readBoundedText\(request,\s*24_000/);
  assert.match(route, /enforceAgentRateLimit/);
  assert.match(route, /requireEvidenceAuthority/);
  assert.match(route, /writeExecutionAudit/);
  assert.match(route, /Cache-Control":\s*"no-store"/);
});

test("Explore-only release workflow cannot deploy CB-CAP", () => {
  assert.doesNotMatch(workflow, /build:platform/);
  assert.doesNotMatch(workflow, /CBCAP_APP_ID/);
  assert.doesNotMatch(workflow, /d307qqji18y8il/);
  assert.match(workflow, /PUBLIC_APP_ID/);
  assert.match(workflow, /npm ci --omit=optional/);
  assert.match(workflow, /verify:public-runtime-security/);
  assert.match(workflow, /test:national-api/);
  assert.match(workflow, /explore\.visual\.spec\.ts/);
  assert.match(workflow, /aws amplify update-app[\s\S]*--build-spec "\$public_build_spec"/);
  assert.match(workflow, /aws amplify update-branch[\s\S]*--branch-name "\$AMPLIFY_BRANCH"[\s\S]*--build-spec "\$public_build_spec"/);
  assert.match(workflow, /expected_build_spec_hash/);
});

test("production Explore requests are tied to persisted canonical geography and approved snapshots", () => {
  assert.match(runtimeAuthority, /requirePublishedEvidenceSnapshot/);
  assert.match(runtimeAuthority, /authority='census'/);
  assert.match(runtimeAuthority, /kind='county'/);
  assert.match(runtimeAuthority, /requireEvidenceGeographyId/);
  assert.match(exploreRoute, /requirePublishedEvidenceSnapshot/);
  assert.match(exploreRoute, /requireEvidenceGeographyId\(evidenceGeoid, placeAgentRuntimeVersions\.snapshotContentHash\)/);
  assert.match(placeBriefRoute, /requirePublishedEvidenceSnapshot/);
  assert.match(placeBriefRoute, /requireEvidenceGeographyId\(geoid, placeAgentRuntimeVersions\.snapshotContentHash\)/);
});

test("staging acceptance capacity is isolated from production agent limits", () => {
  assert.match(stagingWorkflow, /STAGING_BRANCH:\s*\$\{\{\s*github\.ref_name\s*\}\}/);
  assert.match(stagingWorkflow, /PLACE_AGENT_MAX_PER_NETWORK_HOUR:"20"/);
  assert.match(stagingWorkflow, /PLACE_AGENT_MAX_GLOBAL_DAY:"100"/);
  assert.match(stagingWorkflow, /PLACE_AGENT_RATE_LIMIT_NAMESPACE:"staging"/);
  assert.match(workflow, /PLACE_AGENT_MAX_PER_NETWORK_HOUR:"2"/);
  assert.match(workflow, /PLACE_AGENT_MAX_GLOBAL_DAY:"10"/);
  assert.match(workflow, /PLACE_AGENT_RATE_LIMIT_NAMESPACE:"production"/);
});

test("agent rate-limit namespaces cannot collide across environments", () => {
  assert.equal(agentRateLimitNamespace("staging"), "staging");
  assert.equal(agentRateLimitNamespace("production"), "production");
  assert.equal(agentRateLimitNamespace("INVALID/NAMESPACE"), "production");
  assert.equal(agentRateLimitNamespace(""), "production");
});

test("Evidence rate limits require explicit environment-scoped configuration", () => {
  assert.match(evidenceRateLimit, /process\.env\.EVIDENCE_RATE_LIMIT_TABLE/);
  assert.match(evidenceRateLimit, /process\.env\.EVIDENCE_RATE_LIMIT_SALT_SECRET_ARN/);
  assert.doesNotMatch(evidenceRateLimit, /CONTACT_RATE_LIMIT|CONTACT_SUBMISSIONS/);
  assert.match(workflow, /EVIDENCE_RATE_LIMIT_TABLE:\$rate_table/);
  assert.match(workflow, /EVIDENCE_RATE_LIMIT_SALT_SECRET_ARN:\$rate_salt/);
  assert.match(stagingWorkflow, /EVIDENCE_RATE_LIMIT_TABLE:\$rate_table/);
});

test("production activates the approved Foundation workspace tenant idempotently", () => {
  assert.match(workflow, /INSERT INTO evidence\.workspace_tenant/);
  assert.match(workflow, /The SozoRock Foundation, Inc\./);
  assert.match(workflow, /ON CONFLICT \(id\) DO UPDATE SET legal_name=EXCLUDED\.legal_name, status='active'/);
});

test("production consumes the dedicated AWS-managed agent secret without key material in GitHub", () => {
  assert.match(workflow, /OPENAI_PLACE_EVIDENCE_SECRET_ARN:\s*\$\{\{\s*secrets\.OPENAI_PLACE_EVIDENCE_SECRET_ARN\s*\}\}/);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY_BOOTSTRAP/);
  assert.doesNotMatch(workflow, /aws secretsmanager put-secret-value/);
  assert.match(evidenceInfrastructure, /PlaceEvidenceOpenAISecretArn/);
  assert.match(evidenceInfrastructure, /Sid:\s*ReadPlaceEvidenceOpenAISecret/);
  assert.match(evidenceInfrastructure, /Action:\s*\n\s*-\s*secretsmanager:GetSecretValue/);
});

test("public collaboration runtime has cluster-scoped transactional Data API access", () => {
  assert.match(evidenceInfrastructure, /rds-data:BeginTransaction/);
  assert.match(evidenceInfrastructure, /rds-data:CommitTransaction/);
  assert.match(evidenceInfrastructure, /rds-data:ExecuteStatement/);
  assert.match(evidenceInfrastructure, /rds-data:RollbackTransaction/);
  assert.match(evidenceInfrastructure, /Resource:\s*!GetAtt EvidenceDatabaseCluster\.DBClusterArn/);
  assert.doesNotMatch(evidenceInfrastructure, /Resource:\s*["']?\*["']?/);
});

test("public Evidence runtime uses a dedicated least-privileged database login", () => {
  assert.match(evidenceInfrastructure, /EvidenceRuntimeSecret:/);
  assert.match(evidenceInfrastructure, /username.*evidence_runtime_login/);
  assert.match(evidenceInfrastructure, /Resource:\s*!Ref EvidenceRuntimeSecret/);
  assert.doesNotMatch(
    evidenceInfrastructure.match(/EvidenceRuntimePolicy:[\s\S]*?DatabaseEvents:/)?.[0] ?? "",
    /MasterUserSecret/,
  );
  assert.match(runtimeRoleMigration, /CREATE ROLE evidence_runtime NOLOGIN/);
  assert.match(runtimeRoleMigration, /NOSUPERUSER NOCREATEDB NOCREATEROLE/);
  assert.match(runtimeRoleMigration, /NOBYPASSRLS/);
  assert.doesNotMatch(runtimeRoleMigration, /GRANT ALL|SELECT ON ALL TABLES/);
  assert.match(workflow, /EVIDENCE_DATABASE_ADMIN_SECRET_ARN|admin_secret_arn/);
  assert.match(workflow, /configure_runtime_login/);
  assert.match(workflow, /rolsuper, rolcreatedb, rolcreaterole, rolbypassrls/);
});

test("public runtime removes optional Sharp while preserving upstream lock metadata", () => {
  assert.match(nextConfig, /unoptimized:\s*true/);
  assert.doesNotMatch(nextConfig, /^\s*env:\s*\{/m);
  assert.match(amplifyBuild, /PUBLICATION_HASH_SALT_SECRET_ARN/);
  assert.doesNotMatch(amplifyBuild, /env \| grep/);
  assert.match(runtimeVerifier, /Runtime trace imports Sharp\/libvips/);
  assert.match(runtimeVerifier, /Rendered HTML depends on \/_next\/image/);
  assert.match(runtimeVerifier, /AWS resource identifier/);
  const versions = Object.entries(packageLock.packages)
    .filter(([name]) => /(^|\/)sharp$/.test(name))
    .map(([, value]) => ({ version: value.version, optional: value.optional }));
  assert.ok(versions.length > 0, "upstream optional dependency metadata must remain auditable");
  assert.ok(versions.every(({ optional }) => optional === true));
});
