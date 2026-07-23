import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const provider = await readFile(new URL("../app/lib/place-agent-openai.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/evidence/v1/agent/route.ts", import.meta.url), "utf8");
const workflow = await readFile(new URL("../../../.github/workflows/explore-production.yml", import.meta.url), "utf8");
const packageLock = JSON.parse(await readFile(new URL("../../../package-lock.json", import.meta.url), "utf8"));

test("production agent is evidence-only, stored-output disabled, bounded, and tool allowlisted", () => {
  assert.match(provider, /store:\s*false/);
  assert.match(provider, /PLACE_AGENT_TOOL_DEFINITIONS/);
  assert.match(provider, /MAX_TOOL_DEPTH\s*=\s*6/);
  assert.match(provider, /REQUEST_TIMEOUT_MS\s*=\s*22_000/);
  assert.doesNotMatch(provider, /web_search|computer_use|file_search|https?:\/\/(?!api\.openai\.com)/);
});

test("unsupported claims and clinical questions fail closed", () => {
  assert.match(provider, /claim does not exactly match the approved evidence package/);
  assert.match(provider, /cannot provide medical advice/);
  assert.match(provider, /safetyRefusal/);
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
  assert.match(workflow, /npm ls sharp --all/);
});

test("locked production graph contains no Sharp release below 0.35", () => {
  const versions = Object.entries(packageLock.packages)
    .filter(([name]) => /(^|\/)sharp$/.test(name))
    .map(([, value]) => value.version);
  assert.ok(versions.length > 0);
  for (const version of versions) {
    const [major, minor] = version.split(".").map(Number);
    assert.ok(major > 0 || minor >= 35, `unsafe Sharp ${version}`);
  }
});
