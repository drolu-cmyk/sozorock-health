import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("public exports use decision-maker language and the approved wordmark order", async () => {
  const [page, domain] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../packages/domain/src/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(domain, /Demonstration information; not current county performance/);
  assert.doesNotMatch(domain, /seed data/i);
  assert.match(page, /SozoRock® Health · County-Based Community Access Platform/);
  assert.doesNotMatch(page, /SozoRock Health®/);
});
