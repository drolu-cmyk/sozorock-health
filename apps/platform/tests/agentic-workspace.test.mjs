import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { agenticApiUrl, agenticRuntimeConfig, CBCAP_AGENTIC_API_ORIGIN } from "../app/lib/agentic-runtime.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("agentic calls are pinned to the exact production API origin", async () => {
  const [api, nextConfig] = await Promise.all([source("app/lib/agentic-api.ts"), source("next.config.ts")]);
  assert.equal(CBCAP_AGENTIC_API_ORIGIN, "https://api.cbcap.sozorockfoundation.org");
  assert.equal(agenticApiUrl("/api/cbcap"), "https://api.cbcap.sozorockfoundation.org/api/cbcap");
  assert.throws(() => agenticApiUrl("https://example.com/api/cbcap"));
  assert.match(api, /agenticApiUrl\("\/api\/health"\)/);
  assert.match(api, /agenticApiUrl\(path\)/);
  assert.match(nextConfig, /https:\/\/api\.cbcap\.sozorockfoundation\.org/);
  assert.match(nextConfig, /connect-src \$\{connectSources\.join/);
  assert.doesNotMatch(api, /\/api\/cbcap\/(funding|monitoring|private-evidence)/);
});

test("missing or origin-drifted runtime configuration disables controls", () => {
  const previous = {
    base: process.env.NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE,
    domain: process.env.NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN,
    client: process.env.NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID,
    redirect: process.env.NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI,
  };
  delete process.env.NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN;
  delete process.env.NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID;
  delete process.env.NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI;
  assert.equal(agenticRuntimeConfig().enabled, false);
  process.env.NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN = "https://identity.example.com";
  process.env.NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID = "client";
  process.env.NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI = "https://cbcap.sozorockfoundation.org/auth/callback";
  delete process.env.NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE;
  assert.equal(agenticRuntimeConfig().enabled, false);
  process.env.NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE = CBCAP_AGENTIC_API_ORIGIN;
  delete process.env.NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI;
  assert.equal(agenticRuntimeConfig().enabled, false);
  process.env.NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE = "https://example.com";
  process.env.NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN = "https://identity.example.com";
  process.env.NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID = "client";
  process.env.NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI = "https://cbcap.sozorockfoundation.org";
  assert.equal(agenticRuntimeConfig().enabled, false);
  process.env.NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE = CBCAP_AGENTIC_API_ORIGIN;
  process.env.NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI = "https://cbcap.sozorockfoundation.org/auth/callback/";
  assert.equal(agenticRuntimeConfig().enabled, false);
  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE: previous.base,
    NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN: previous.domain,
    NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID: previous.client,
    NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI: previous.redirect,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("PKCE keeps tokens out of URLs and browser storage", async () => {
  const [auth, callback] = await Promise.all([
    source("app/lib/agentic-auth.ts"),
    source("app/auth/callback/page.tsx"),
  ]);
  assert.match(auth, /response_type: "code"/);
  assert.match(auth, /code_challenge_method: "S256"/);
  assert.match(auth, /let inMemoryTokens/);
  assert.match(auth, /let refreshInFlight/);
  assert.match(auth, /let callbackInFlight/);
  assert.match(auth, /if \(callbackInFlight\) return callbackInFlight/);
  assert.match(auth, /window\.history\.replaceState/);
  assert.doesNotMatch(auth, /window\.location\.hash/);
  assert.doesNotMatch(auth, /localStorage/);
  assert.doesNotMatch(auth, /access_token.*searchParams|searchParams.*access_token/);
  assert.match(callback, /completeCognitoCallback\(config\)/);
  assert.match(callback, /router\.replace\("\/#agentic-workspace"\)/);
  assert.doesNotMatch(callback, /window\.location|localStorage/);
});

test("human review is visibly and programmatically bound to the exact returned run", async () => {
  const [component, api] = await Promise.all([
    source("app/components/AgenticWorkspace.tsx"),
    source("app/lib/agentic-api.ts"),
  ]);
  assert.match(component, /run\?\.runId !== runId/);
  assert.match(component, /run\.status !== "awaiting_human_review"/);
  assert.match(component, /runCountyGeoid !== countyGeoid/);
  assert.match(component, /contextVersion\.current !== initiatingContext/);
  assert.match(component, /approveRun\(reviewableRunId\)/);
  assert.match(component, /Approve run \$\{reviewableRunId\}/);
  assert.match(api, /`\/api\/cbcap\/runs\/\$\{encodeURIComponent\(runId\)\}\/review`/);
  assert.match(api, /\{ decision: "approve" \}/);
});

test("the existing dashboard hands selected county context to the additive workspace", async () => {
  const dashboard = await source("app/Dashboard.tsx");
  const component = await source("app/components/AgenticWorkspace.tsx");
  assert.match(dashboard, /<AgenticWorkspace profile=\{profile\} \/>/);
  assert.match(component, /profile\?\.kind === "county"/);
  assert.match(component, /startCbcapRun\(config, initiatingGeoid\)/);
  assert.match(component, /const initiatingGeoid = county\.geoid/);
  assert.match(component, /createVisualizationSpec\(config, run\)/);
  assert.doesNotMatch(component, /funding|monitoring|private upload/i);
});

test("malformed citation URLs are ignored without throwing during rendering", async () => {
  const component = await source("app/components/AgenticWorkspace.tsx");
  assert.match(component, /function citationUrl/);
  assert.match(component, /try \{/);
  assert.match(component, /url\.protocol !== "https:"/);
  assert.doesNotMatch(component, /label \|\| new URL\(url\)\.hostname/);
});

test("deployment documentation names every fail-closed public runtime input", async () => {
  const [documentation, workflow] = await Promise.all([
    source("AGENTIC_RUNTIME.md"),
    source("../../.github/workflows/deploy-cbcap.yml"),
  ]);
  for (const key of [
    "NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE",
    "NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN",
    "NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID",
    "NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI",
  ]) assert.match(documentation, new RegExp(key));
  assert.match(documentation, /authorization-code flow, PKCE/);
  assert.match(documentation, /https:\/\/cbcap\.sozorockfoundation\.org\/auth\/callback/);
  assert.match(documentation, /https:\/\/cbcap\.sozorockfoundation\.org\//);
  assert.match(workflow, /CBCAP_COGNITO_DOMAIN: \$\{\{ vars\.CBCAP_COGNITO_DOMAIN \}\}/);
  assert.match(workflow, /CBCAP_COGNITO_CLIENT_ID: \$\{\{ vars\.CBCAP_COGNITO_CLIENT_ID \}\}/);
  assert.match(workflow, /NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN: \$\{\{ vars\.CBCAP_COGNITO_DOMAIN \}\}/);
  assert.match(workflow, /NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI: https:\/\/cbcap\.sozorockfoundation\.org\/auth\/callback/);
  assert.match(workflow, /NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI:\$callback/);
});
