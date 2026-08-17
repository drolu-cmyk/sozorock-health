import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../scripts/render-final.mjs", import.meta.url), "utf8");

test("final rendering acquires its lock atomically and fails closed on an existing lock", () => {
  assert.match(source, /openSync\(lockPath, "wx"\)/);
  assert.match(source, /error\?\.code === "EEXIST"/);
  assert.match(source, /remove.*stale lock manually/i);
  assert.doesNotMatch(source, /if \(existsSync\(lockPath\)\)/);
  assert.doesNotMatch(source, /readFileSync\(lockPath/);
});
