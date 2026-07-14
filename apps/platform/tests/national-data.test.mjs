import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataUrl = new URL("../data/county-planning.json", import.meta.url);
const manifestUrl = new URL("../data/source-manifest.json", import.meta.url);
const boundaryUrl = new URL("../public/data/cbcap-boundaries-2025.json", import.meta.url);
const boundaryManifestUrl = new URL("../data/boundary-manifest.json", import.meta.url);

async function fixture() {
  const [raw, manifestRaw] = await Promise.all([readFile(dataUrl, "utf8"), readFile(manifestUrl, "utf8")]);
  return { raw, counties: JSON.parse(raw), manifest: JSON.parse(manifestRaw) };
}

test("contains every U.S. county equivalent across 50 states and D.C.", async () => {
  const { counties, manifest } = await fixture();
  assert.equal(counties.length, 3144);
  assert.equal(new Set(counties.map((county) => county.fips)).size, 3144);
  assert.equal(new Set(counties.map((county) => county.stateFips)).size, 51);
  assert.ok(counties.every((county) => /^\d{5}$/.test(county.fips)));
  assert.ok(counties.every((county) => county.state && county.stateCode));
  assert.ok(counties.every((county) => !/[ÂÃ�]/u.test(`${county.county}${county.state}${county.stateCode}`)));
  assert.ok(counties.every((county) => county.centroid.lat >= -90 && county.centroid.lat <= 90));
  assert.ok(counties.every((county) => county.centroid.lon >= -180 && county.centroid.lon <= 180));
  assert.equal(manifest.quality.actualCountyEquivalents, 3144);
  assert.equal(manifest.quality.uniqueFips, 3144);
});

test("uses current Census geometry for every county data record", async () => {
  const [{ counties }, boundaryRaw, boundaryManifestRaw] = await Promise.all([
    fixture(),
    readFile(boundaryUrl, "utf8"),
    readFile(boundaryManifestUrl, "utf8"),
  ]);
  const boundaries = JSON.parse(boundaryRaw);
  const manifest = JSON.parse(boundaryManifestRaw);
  assert.equal(boundaries.counties.length, 3144);
  assert.equal(new Set(boundaries.counties.map((feature) => feature.id)).size, 3144);
  assert.equal(boundaries.states.length, 51);
  assert.deepEqual(
    new Set(boundaries.counties.map((feature) => feature.id)),
    new Set(counties.map((county) => county.fips)),
  );
  assert.equal(createHash("sha256").update(boundaryRaw).digest("hex"), manifest.sha256);
  for (const fips of ["02063", "02066", "09110", "09120", "09130", "09140", "09150", "09160", "09170", "09180", "09190"]) {
    assert.ok(boundaries.counties.some((feature) => feature.id === fips), `Missing current boundary ${fips}`);
  }
});

test("keeps unavailable public estimates null instead of manufacturing zero performance", async () => {
  const { counties, manifest } = await fixture();
  const unavailable = counties.filter((county) => county.sourceStatus === "not-available");
  assert.equal(unavailable.length, 1);
  for (const county of unavailable) {
    assert.equal(county.population, null);
    assert.equal(county.planning.planningPressure, null);
    assert.equal(county.dataCoverage, 0);
    assert.ok(Object.values(county.conditions).every((metric) => metric.value === null));
  }
  assert.equal(manifest.indicators.matchedCountyCount, 3143);
});

test("does not manufacture a composite planning percentile from one available component", async () => {
  const { counties, manifest } = await fixture();
  const oneComponent = counties.filter((county) => {
    const components = [
      county.planning.chronicPercentile,
      county.planning.barrierPercentile,
      county.planning.preventionOpportunityPercentile,
    ].filter((value) => value !== null);
    return components.length === 1;
  });
  assert.ok(oneComponent.length > 0, "Expected the source snapshot to contain partial county profiles");
  assert.ok(oneComponent.every((county) => county.planning.planningPressure === null));
  assert.equal(
    manifest.quality.planningIndexAvailable,
    counties.filter((county) => county.planning.planningPressure !== null).length,
  );
});

test("keeps estimates, intervals, percentiles, and coverage within valid ranges", async () => {
  const { counties } = await fixture();
  for (const county of counties) {
    assert.ok(county.dataCoverage >= 0 && county.dataCoverage <= 100);
    for (const metric of [...Object.values(county.conditions), ...Object.values(county.barriers), ...Object.values(county.prevention)]) {
      if (metric.value !== null) assert.ok(metric.value >= 0 && metric.value <= 100);
      if (metric.ci !== null) {
        assert.ok(metric.ci[0] <= metric.ci[1]);
        if (metric.value !== null) assert.ok(metric.value >= metric.ci[0] - 0.2 && metric.value <= metric.ci[1] + 0.2);
      }
    }
    for (const value of Object.values(county.planning)) if (value !== null) assert.ok(value >= 0 && value <= 100);
  }
});

test("records reproducible source lineage and the exact snapshot hash", async () => {
  const { raw, manifest } = await fixture();
  assert.equal(createHash("sha256").update(raw).digest("hex"), manifest.quality.sha256);
  assert.match(manifest.geography.source, /Census Bureau TIGERweb/);
  assert.match(manifest.indicators.source, /CDC PLACES/);
  assert.match(manifest.demonstrationIndex.boundary, /Not a government designation/);
});
