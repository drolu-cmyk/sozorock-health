import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("public exports use decision-maker language and the approved legal identity", async () => {
  const [dashboard, lockup] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BrandLockup.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /The SozoRock Foundation, Inc\./);
  assert.match(dashboard, /planning index and scenarios demonstrate planning capability/);
  assert.match(dashboard, /Print \/ save PDF/);
  assert.doesNotMatch(dashboard, /disclosure-safe|illustrative composite measure|seed data/i);
  assert.match(lockup, /<sup aria-hidden="true">®<\/sup>/);
  assert.match(lockup, /sozorock-wordmark-clean-v2\.png/);
  assert.match(lockup, /priority=\{priority\}/);
  assert.match(dashboard, /<BrandLockup priority \/>/);
  assert.match(dashboard, /<BrandLockup compact \/>/);
  assert.doesNotMatch(dashboard, /<BrandLockup compact priority/);
});

test("public application source contains no common UTF-8 mojibake", async () => {
  const appRoot = new URL("../app/", import.meta.url);
  const files = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isDirectory()) await collect(url);
      else if (/\.(?:ts|tsx|css)$/.test(entry.name)) files.push(url);
    }
  }
  await collect(appRoot);
  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.equal(/[\u00c2\u00c3\ufffd]/u.test(source), false, `Mojibake marker found in ${file.pathname}`);
  }
});
