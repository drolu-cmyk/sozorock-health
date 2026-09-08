import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const workflow = yaml.load(readFileSync(new URL("../../../.github/workflows/explore-production.yml", import.meta.url), "utf8"));
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";

test("every production release shell step parses before it can reach production", { skip: process.platform === "win32" && !existsSync(bash) }, () => {
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps.filter((item) => item.run)) {
      const script = step.run.replace(/\$\{\{[\s\S]*?\}\}/g, "workflow_expression");
      const result = spawnSync(bash, ["-n"], { input: script, encoding: "utf8" });
      assert.equal(result.status, 0, `${step.name}: ${result.stderr || result.error || "invalid shell"}`);
    }
  }
});
