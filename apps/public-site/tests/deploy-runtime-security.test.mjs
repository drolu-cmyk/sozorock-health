import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function rootSource(path) {
  return readFile(new URL(`../../../${path}`, import.meta.url), "utf8");
}

test("production deploy installs the same optional-dependency boundary verified by CI", async () => {
  const deployWorkflow = await rootSource(".github/workflows/deploy.yml");
  const verifyWorkflow = await rootSource(".github/workflows/ci.yml");

  assert.match(verifyWorkflow, /npm ci --omit=optional/);
  assert.match(deployWorkflow, /npm ci --omit=optional/);
  assert.doesNotMatch(deployWorkflow, /\n\s+npm ci\s*\n/);

  const installIndex = deployWorkflow.indexOf("npm ci --omit=optional");
  const buildIndex = deployWorkflow.indexOf("npm run build:public");
  const securityIndex = deployWorkflow.indexOf("npm run verify:public-runtime-security");

  assert.ok(installIndex >= 0 && buildIndex > installIndex);
  assert.ok(securityIndex > buildIndex);
});

test("scheduled source health builds the public runtime before inspecting it", async () => {
  const operationsWorkflow = await rootSource(
    ".github/workflows/place-evidence-operations.yml",
  );
  const buildIndex = operationsWorkflow.indexOf("npm run build:public");
  const securityIndex = operationsWorkflow.indexOf(
    "npm run verify:public-runtime-security",
  );

  assert.ok(buildIndex >= 0);
  assert.ok(securityIndex > buildIndex);
});

test("public release does not resolve retired database authority and preserves independent identity", async () => {
  const workflow = await rootSource(".github/workflows/deploy.yml");
  assert.doesNotMatch(workflow, /describe-stacks --stack-name sozorock-health-evidence-production/);
  assert.match(workflow, /node scripts\/evidence-deployment-environment\.mjs/);
  assert.match(workflow, /describe-stacks --stack-name sozorock-explore-collaboration-production/);
  assert.match(workflow, /EXPLORE_COGNITO_USER_POOL_ID/);
  for (const [path, job] of [["explore-production.yml", "deploy-explore"], ["milestone-10-staging.yml", "isolated-staging"]]) {
    const workflow = await rootSource(`.github/workflows/${path}`);
    const definition = workflow.slice(workflow.indexOf(`  ${job}:`)).split(/\n  [a-z][a-z-]+:/)[0];
    assert.match(definition, /\n    if: \$\{\{ false \}\}/);
    assert.match(workflow, /\n  retired-release:\n    needs: release-gates/);
    assert.match(workflow.slice(workflow.indexOf("  retired-release:")), /exit 1/);
  }
});
