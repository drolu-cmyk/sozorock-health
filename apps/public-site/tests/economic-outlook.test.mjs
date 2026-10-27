import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { getPublication, publications } from "../app/lib/publications.ts";

test("the approved outlook is delivered privately with one Foundation canonical page", () => {
  const record = getPublication("economic-outlook-october-2026");
  assert.ok(record);
  assert.equal(record.canonicalUrl, "https://www.sozorockfoundation.org/publication/economic-outlook-october-2026");
  assert.equal(record.doi, undefined);
  assert.equal(record.author, "Dr Oluwabiyi Adeyemo");
  assert.equal(record.assetKey, "economic-outlook-october-2026.pdf");
  assert.ok(!publications.some(p => p.slug === record.slug), "delivery registration does not add a duplicate Health series");
  const pdf = readFileSync(new URL(`../../../infrastructure/assets/publications/${record.assetKey}`, import.meta.url));
  assert.equal(createHash("sha256").update(pdf).digest("hex"), "91a32c1fbca67cfbb9143709f7dc1549b941b3dc3eaebfcd9522c54535406b09");
  assert.equal(existsSync(new URL(`../public/publications/${record.assetKey}`, import.meta.url)), false);
});
