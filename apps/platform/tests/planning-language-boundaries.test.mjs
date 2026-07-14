import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { barrierMetrics, planningBarrierMetrics } from "../app/lib/metrics.ts";

test("disability is accessibility context, never a ranked pathway barrier", () => {
  const disability = barrierMetrics.find((metric) => metric.key === "disability");
  assert.equal(disability?.direction, "neutral");
  assert.match(disability?.label ?? "", /accessibility context/i);
  assert.equal(planningBarrierMetrics.some((metric) => metric.key === "disability"), false);
});

test("disability never influences pathway-barrier or composite calculations", async () => {
  const [records, manifest, refreshSource, serverSource] = await Promise.all([
    readFile(new URL("../data/county-planning.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../data/source-manifest.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../../../scripts/refresh-cbcap-data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/server-data.ts", import.meta.url), "utf8"),
  ]);
  const keys = [
    "uninsured",
    "transportation",
    "foodInsecurity",
    "housingInsecurity",
    "utilityShutoff",
    "loneliness",
  ];
  const mean = (values) => values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
  const eligibleValues = (record) => keys
    .map((key) => record.barriers[key].value)
    .filter((value) => value !== null);
  const barrierMean = (record) => {
    const values = eligibleValues(record);
    return values.length >= 2 ? mean(values) : null;
  };
  const distribution = records
    .map(barrierMean)
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
  const percentile = (value) => value === null
    ? null
    : Math.round((distribution.filter((candidate) => candidate <= value).length / distribution.length) * 100);
  const composite = (record, barrierPercentile) => {
    const components = [
      record.planning.chronicPercentile === null ? null : { value: record.planning.chronicPercentile, weight: 0.45 },
      barrierPercentile === null ? null : { value: barrierPercentile, weight: 0.35 },
      record.planning.preventionOpportunityPercentile === null
        ? null
        : { value: record.planning.preventionOpportunityPercentile, weight: 0.2 },
    ].filter(Boolean);
    const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
    return components.length >= 2 && totalWeight
      ? Math.round(components.reduce((sum, component) => sum + component.value * component.weight, 0) / totalWeight)
      : null;
  };

  for (const record of records) {
    const expectedBarrierPercentile = percentile(barrierMean(record));
    assert.equal(record.planning.barrierPercentile, expectedBarrierPercentile, record.fips);
    assert.equal(record.planning.planningPressure, composite(record, expectedBarrierPercentile), record.fips);
    if (eligibleValues(record).length < 2) {
      assert.equal(record.planning.barrierPercentile, null, `${record.fips} must not publish a one-measure barrier percentile`);
    }
  }

  const disabilityExample = records.find((record) => record.barriers.disability.value !== null);
  assert.ok(disabilityExample);
  const changedDisability = structuredClone(disabilityExample);
  changedDisability.barriers.disability.value = 100;
  assert.equal(barrierMean(changedDisability), barrierMean(disabilityExample));
  assert.equal(percentile(barrierMean(changedDisability)), disabilityExample.planning.barrierPercentile);

  const refreshKeyset = refreshSource.match(/const PLANNING_BARRIER_KEYS[\s\S]*?\]\);/)?.[0] ?? "";
  const serverKeyset = serverSource.match(/const planningBarrierKeys[\s\S]*?\];/)?.[0] ?? "";
  assert.doesNotMatch(refreshKeyset, /disability/);
  assert.doesNotMatch(serverKeyset, /disability/);
  assert.match(refreshSource, /MIN_PLANNING_BARRIER_MEASURES = 2/);
  assert.match(serverSource, /minimumPlanningBarrierMeasures = 2/);
  assert.match(manifest.demonstrationIndex.formula, /Disability is retained only as accessibility context and is excluded/i);
  assert.match(manifest.demonstrationIndex.formula, /requires at least two eligible pathway-barrier measures/i);
  assert.match(manifest.demonstrationIndex.formula, /lack of health insurance, lack of reliable transportation, food insecurity, housing insecurity, utility shutoff or threat, and loneliness/i);
  assert.doesNotMatch(manifest.demonstrationIndex.formula, /reliable transportation, food security, housing security, utility security/i);
  assert.equal(records.length, 3144);
  assert.equal(new Set(records.map((record) => record.fips)).size, 3144);
  assert.equal(records.filter((record) => record.sourceStatus === "available").length, 3143);
  assert.equal(manifest.quality.actualCountyEquivalents, records.length);
  assert.equal(manifest.quality.planningIndexAvailable, records.filter((record) => record.planning.planningPressure !== null).length);
});

test("public planning language distinguishes estimates, scenarios, and forecasts", async () => {
  const [scenario, brief, workspace] = await Promise.all([
    readFile(new URL("../app/components/ScenarioPlanner.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/IntelligenceBrief.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PlanningWorkspace.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(scenario, /population-equivalent scenario/i);
  assert.match(scenario, /not diagnosed people, future cases, observed service demand, or a forecast/i);
  assert.doesNotMatch(scenario, /planned completed pathways\/year|Explore a need range/i);
  assert.doesNotMatch(brief, /Observed estimate/);
  assert.match(brief, /Published model-based condition estimate/);
  assert.match(workspace, /published model-based estimate/i);
});

test("public evidence displays never rank unlike measures as priorities", async () => {
  const [dashboard, brief, workspace, report, metrics, methodology] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/IntelligenceBrief.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PlanningWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ReportStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/metrics.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../docs/cbcap-data-methodology.md", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(metrics, /largestBenchmarkGap/);
  assert.doesNotMatch(workspace, /\.sort\(/);
  assert.doesNotMatch(report, /Largest displayed (condition|barrier) estimates/i);
  assert.doesNotMatch(dashboard, /Leading (condition|pathway-barrier) estimate/i);
  assert.doesNotMatch(brief, /largest (condition|pathway-barrier) gap/i);
  assert.match(workspace, /fixed published order and are not a priority ranking/i);
  assert.match(report, /Not a priority ranking; eligible populations vary by measure/i);
  assert.match(brief, /fixed published order/i);
  assert.match(methodology, /disability measure is retained separately as accessibility context/i);
  assert.match(methodology, /excluded from the pathway-barrier percentile and from the composite calculation/i);
});
