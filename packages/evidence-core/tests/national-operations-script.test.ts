import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("national operations report reflects current implementation instead of stale fixture-era blockers", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--experimental-strip-types", "scripts/evaluate-national-operations.ts"],
    { cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..") },
  );
  const report = JSON.parse(stdout) as {
    controls: Array<{ id: string; status: string; evidence: string[] }>;
  };
  const controlById = new Map(report.controls.map((control) => [control.id, control]));
  assert.equal(controlById.get("audited-evidence-store")?.status, "pass");
  assert.equal(controlById.get("public-rate-limits")?.status, "pass");
  assert.equal(controlById.get("agent-execution-audit")?.status, "pass");
  assert.equal(controlById.get("security-review")?.status, "not_run");
  const evidence = report.controls.flatMap((control) => control.evidence).join(" ");
  assert.doesNotMatch(evidence, /queries a live public endpoint directly/i);
  assert.doesNotMatch(evidence, /three unresolved high-severity/i);
});
