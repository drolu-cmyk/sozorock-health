import assert from "node:assert/strict";
import test from "node:test";
import { resolveEvidenceCounty } from "../app/lib/county-resolution.ts";

test("a cross-county ZCTA returns every county and does not silently select one", async () => {
  const resolution = await resolveEvidenceCounty({ kind: "zip", geoid: "12010", label: "12010" });
  assert.equal(resolution.status, "selection_required");
  assert.equal(resolution.selectedCountyGeoid, null);
  assert.deepEqual(
    resolution.counties.map((county) => county.countyGeoid),
    ["36057", "36035", "36091", "36093"],
  );
  assert.ok(resolution.counties.every((county) => county.overlapAreaPercent !== null));
  assert.ok(resolution.caveats.some((caveat) => caveat.includes("postal ZIP Code is not a Census ZCTA")));
});

test("an explicitly selected overlapping county becomes the evidence scope", async () => {
  const resolution = await resolveEvidenceCounty({
    kind: "zip",
    geoid: "12010",
    label: "12010",
    selectedCountyGeoid: "36093",
  });
  assert.equal(resolution.status, "resolved");
  assert.equal(resolution.selectedCountyGeoid, "36093");
  assert.equal(resolution.original.geoid, "12010");
});

test("a county resolves directly without changing its GEOID", async () => {
  const resolution = await resolveEvidenceCounty({
    kind: "county",
    geoid: "11001",
    label: "District of Columbia",
  });
  assert.equal(resolution.status, "resolved");
  assert.equal(resolution.selectedCountyGeoid, "11001");
  assert.equal(resolution.counties[0].calculationMethod, "Direct official Census county GEOID resolution");
});
