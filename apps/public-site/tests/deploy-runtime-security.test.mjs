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
