import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scriptUrl = new URL("../scripts/run-non-explore-regression.mjs", import.meta.url);

test("non-Explore regression evidence resolves from repository root for workflow upload and comparison", async () => {
  const source = await readFile(scriptUrl, "utf8");
  assert.match(source, /repositoryRoot = path\.resolve\(scriptDirectory, "\.\.\/\.\.\/\.\."\)/);
  assert.match(source, /evidenceDirectory = path\.resolve\(repositoryRoot, evidenceDirectoryInput\)/);
  assert.doesNotMatch(source, /path\.resolve\(process\.cwd\(\), evidenceDirectoryInput\)/);
});
