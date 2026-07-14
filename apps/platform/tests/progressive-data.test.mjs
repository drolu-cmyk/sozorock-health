import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inflateCountyMap } from "../app/lib/compact-counties.ts";

const fullUrl = new URL("../data/county-planning.json", import.meta.url);
const summaryUrl = new URL("../data/dashboard-summary.json", import.meta.url);
const compactUrl = new URL("../public/data/cbcap-county-map-2025.json", import.meta.url);

test("keeps the first dashboard payload small and defers county intelligence", async () => {
  const [summaryRaw, compactRaw, dashboardSource] = await Promise.all([
    readFile(summaryUrl, "utf8"),
    readFile(compactUrl, "utf8"),
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
  ]);
  assert.ok(Buffer.byteLength(summaryRaw) < 20_000, "Dashboard summary should remain below 20 KiB");
  assert.ok(Buffer.byteLength(compactRaw) < 300_000, "Deferred county snapshot should remain below 300 KiB");
  assert.match(dashboardSource, /IntersectionObserver/);
  assert.match(dashboardSource, /cbcap-county-map-2025\.json/);
  assert.doesNotMatch(dashboardSource, /fetch\("\/api\/dashboard/);
});

test("compact county snapshot preserves every mapped field and release hash", async () => {
  const [full, summary, payload] = await Promise.all([
    readFile(fullUrl, "utf8").then(JSON.parse),
    readFile(summaryUrl, "utf8").then(JSON.parse),
    readFile(compactUrl, "utf8").then(JSON.parse),
  ]);
  const inflated = inflateCountyMap(payload, summary.states);
  assert.equal(inflated.length, 3144);
  assert.equal(payload.sourceHash, summary.sources.quality.sha256);

  for (let index = 0; index < full.length; index += 1) {
    const source = full[index];
    const mapped = inflated[index];
    assert.deepEqual(mapped, {
      fips: source.fips,
      stateFips: source.stateFips,
      state: source.state,
      stateCode: source.stateCode,
      county: source.county,
      population: source.population,
      dataCoverage: source.dataCoverage,
      sourceStatus: source.sourceStatus,
      planningPressure: source.planning.planningPressure,
      chronicPercentile: source.planning.chronicPercentile,
      barrierPercentile: source.planning.barrierPercentile,
      preventionOpportunityPercentile: source.planning.preventionOpportunityPercentile,
      diabetes: source.conditions.diabetes.value,
      highBloodPressure: source.conditions.highBloodPressure.value,
      uninsured: source.barriers.uninsured.value,
      transportation: source.barriers.transportation.value,
    });
  }
});
