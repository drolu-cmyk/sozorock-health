import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../../../.github/workflows/source-adapter-proposals.yml", import.meta.url),
  "utf8",
);
const operationsWorkflow = readFileSync(
  new URL("../../../.github/workflows/place-evidence-operations.yml", import.meta.url),
  "utf8",
);

test("source proposal workflow can commit its ignored review handoff", () => {
  assert.match(workflow, /git config user\.name "sozorock-data-automation"/);
  assert.match(workflow, /git config user\.email "41898282\+github-actions\[bot\]@users\.noreply\.github\.com"/);
  assert.match(
    workflow,
    /git add --force -- output\/source-adapter-review\/README\.md output\/source-adapter-review\/change-stat\.txt/,
  );
  assert.match(workflow, /source-adapter-review-\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}/);
});

test("source health checks the same optional-free production dependency tree as release gates", () => {
  assert.match(operationsWorkflow, /npm ci --omit=optional/);
  assert.match(operationsWorkflow, /npm audit --omit=dev --omit=optional --audit-level=moderate/);
  assert.match(operationsWorkflow, /npm ls sharp --all \|\| test "\$\?" -eq 1/);
  assert.match(operationsWorkflow, /test ! -d node_modules\/sharp/);
  assert.match(operationsWorkflow, /npm run verify:public-runtime-security/);
});
