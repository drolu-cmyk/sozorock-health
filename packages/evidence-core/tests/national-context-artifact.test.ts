import assert from "node:assert/strict";
import test from "node:test";

import { buildNationalContextArtifact } from "../scripts/build-national-context-artifact.ts";

test("production national context is deterministic, source-governed, and county complete", async () => {
  const first = await buildNationalContextArtifact();
  const second = await buildNationalContextArtifact();

  assert.deepEqual(second, first);
  assert.equal(first.schemaVersion, "sozorock.national-context.v1");
  assert.equal(first.countyCount, 3_144);
  assert.equal(new Set(first.counties.map((county) => county.fips)).size, 3_144);
  assert.deepEqual(Object.keys(first.sources).sort(), [
    "ahrf-workforce", "ahrq-clh", "census-acs5", "hrsa-workforce",
  ]);
  assert.ok(Object.values(first.sources).every((source) =>
    source.reviewStatus === "verified"
    && /^sha256:[a-f0-9]{64}$/.test(source.contentHash)
    && typeof source.staleAfter === "string"));

  const designations = first.counties.flatMap((county) => [...county.hpsa, ...county.muaP]);
  assert.ok(designations.every((designation) => designation.discipline));
  assert.deepEqual(
    [...new Set(designations.map((designation) => designation.sourceScope))].sort(),
    ["facility", "population_group", "subcounty", "whole_county"],
  );

  const albany = first.counties.find((county) => county.fips === "36001");
  assert.ok(albany);
  assert.equal(albany.acs.find((item) => item.sourceMeasureId === "B01001_E001")?.value, 317_018);
  assert.equal(albany.acs.length, 5);
  assert.equal(albany.ahrf.length, 7);
  assert.equal(albany.ahrq.length, 7);
  assert.ok(albany.hpsa.every((designation: { designationDate?: string | null }) =>
    /^\d{4}-\d{2}-\d{2}$/.test(designation.designationDate ?? "")));
});
