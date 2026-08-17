import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../scripts/render-final.mjs", import.meta.url), "utf8");

test("final rendering acquires its lock atomically and fails closed on an existing lock", () => {
  assert.equal(source.includes('openSync(lockPath, "wx")'), true);
  assert.equal(source.includes('error?.code === "EEXIST"'), true);
  assert.equal(source.includes("remove a stale lock manually"), true);
  assert.equal(source.includes("if (existsSync(lockPath))"), false);
  assert.equal(source.includes("readFileSync(lockPath"), false);
});
