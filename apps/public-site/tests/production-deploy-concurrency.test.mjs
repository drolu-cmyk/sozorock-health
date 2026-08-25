import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("../../../.github/workflows/deploy.yml", import.meta.url);

test("non-production Verify completions cannot cancel the active production deploy", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const jobsOffset = workflow.indexOf("\njobs:\n");

  assert.notEqual(jobsOffset, -1, "Deploy workflow must define jobs");

  const workflowScope = workflow.slice(0, jobsOffset);
  const deployScope = workflow.slice(jobsOffset);

  assert.doesNotMatch(
    workflowScope,
    /\nconcurrency:\s*\n/,
    "workflow-level concurrency would let skipped PR-triggered runs cancel production",
  );
  assert.match(
    deployScope,
    /\n  deploy:\n[\s\S]*?\n    concurrency:\n      group: amplify-d307qqji18y8il-production\n      cancel-in-progress: true\n/,
    "production concurrency must be owned by the deploy job after its main-branch condition passes",
  );
});
