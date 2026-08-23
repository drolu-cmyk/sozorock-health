import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function rootSource(path) {
  return readFile(new URL(`../../../${path}`, import.meta.url), "utf8");
}

test("Evidence Gateway production activation dispatches the governed Explore release for the exact deployed SHA", async () => {
  const activation = await rootSource(
    ".github/workflows/evidence-gateway-production-activation.yml",
  );

  assert.match(activation, /workflows: \["Deploy"\]/);
  assert.match(activation, /types: \[completed\]/);
  assert.match(activation, /actions: write/);
  assert.match(activation, /statuses: write/);
  assert.match(activation, /TARGET_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(activation, /test "\$main_sha" = "\$TARGET_SHA"/);
  assert.match(activation, /actions\/workflows\/\$EXPLORE_WORKFLOW\/dispatches/);
  assert.match(activation, /--arg release_sha "\$TARGET_SHA"/);
  assert.match(activation, /\{ref:\$ref,inputs:\{release_sha:\$release_sha\}\}/);
  assert.match(activation, /production-proof/);
  assert.match(activation, /Production proof blocked because governed activation failed/);
});

test("Evidence Gateway production proof cannot run from a successful Deploy alone", async () => {
  const proof = await rootSource(
    ".github/workflows/evidence-gateway-production-proof.yml",
  );

  assert.match(proof, /workflows: \["Deploy", "Explore production"\]/);
  assert.match(proof, /types: \[requested, completed\]/);
  assert.match(proof, /github\.event\.workflow_run\.name == 'Deploy'/);
  assert.match(proof, /github\.event\.workflow_run\.name == 'Explore production'/);
  assert.match(proof, /Production proof blocked because governed release failed/);

  const proveStart = proof.indexOf("  prove:\n");
  assert.ok(proveStart >= 0, "prove job must exist");
  const proveSection = proof.slice(proveStart, proof.indexOf("    runs-on:", proveStart));

  assert.match(proveSection, /github\.event\.workflow_run\.name == 'Explore production'/);
  assert.doesNotMatch(proveSection, /github\.event\.workflow_run\.name == 'Deploy'/);
  assert.match(proveSection, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(proveSection, /github\.event\.workflow_run\.head_branch == 'main'/);
});

test("Evidence Gateway production proof preserves five-county cache and ETag acceptance", async () => {
  const proof = await rootSource(
    ".github/workflows/evidence-gateway-production-proof.yml",
  );

  assert.match(proof, /counties=\(36001 36093 36057 42029 48029\)/);
  assert.match(
    proof,
    /EXPECTED_CACHE_CONTROL: public, s-maxage=86400, stale-while-revalidate=604800/,
  );
  assert.match(proof, /test "\$etag" = "\\\"\$release_hash\\\""/);
  assert.ok(
    proof.includes('--header "If-None-Match: \\"$albany_release_hash\\""'),
    "conditional request must send the exact release hash as the ETag",
  );
  assert.match(proof, /test "\$conditional_status" = "304"/);
  assert.match(proof, /test ! -s "\$conditional_body"/);
});
