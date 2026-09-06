import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { updateCountyRegistry } from "../../../scripts/update-cbcap-registry.mjs";

const registry = JSON.parse(await readFile(new URL("../data/evidence-registry.json", import.meta.url), "utf8"));
const manifest = { generatedAt: "2026-09-06T12:00:00.000Z", quality: { actualCountyEquivalents: 3144 }, indicators: { matchedCountyCount: 3142 } };

test("refresh binds county provenance to the new snapshot without asserting unrelated verification", () => {
  const original = structuredClone(registry);
  const next = updateCountyRegistry(registry, manifest);
  const county = next.sources.find(({ id }) => id === "cdc-places-county-2025");
  assert.equal(county.freshness.snapshotGeneratedAt, manifest.generatedAt);
  assert.equal(county.coverage.numerator, 3142);
  assert.equal(county.coverage.denominator, 3144);
  assert.match(county.coverage.scope, /3,142 of 3,144/);
  assert.equal(next.verifiedAt, registry.verifiedAt);
  for (const source of next.sources) {
    const prior = registry.sources.find(({ id }) => id === source.id);
    assert.equal(source.freshness.checkedAt, prior.freshness.checkedAt);
    if (!["cdc-places-county-2025", "census-tigerweb-current"].includes(source.id)) assert.deepEqual(source, prior);
  }
  assert.deepEqual(registry, original);
});

test("invalid snapshot coverage fails before registry publication", () => {
  assert.throws(() => updateCountyRegistry(registry, { ...manifest, indicators: { matchedCountyCount: 3145 } }));
  assert.throws(() => updateCountyRegistry(registry, { ...manifest, generatedAt: "invalid" }));
});
