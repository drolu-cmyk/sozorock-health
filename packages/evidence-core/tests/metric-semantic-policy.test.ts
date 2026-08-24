import assert from "node:assert/strict";
import test from "node:test";

import type { MeasureDefinition } from "../src/contracts.ts";
import {
  SAFE_UNCURATED_METRIC_POLICY,
  buildMetricSemanticPolicies,
  metricSemanticPolicyFor,
} from "../src/metric-semantic-policy.ts";

function definition(
  sourceMeasureId: string,
  overrides: Partial<MeasureDefinition> = {},
): MeasureDefinition {
  return {
    id: `measure:${sourceMeasureId}`,
    sourceMeasureId,
    name: sourceMeasureId,
    description: "Controlled semantic policy fixture.",
    direction: "adverse",
    higherValueMeaning: "adverse",
    unit: "percent",
    universe: "Adults",
    adjustment: "modeled",
    comparisonPolicy: "higher_is_concern",
    reviewStatus: "verified",
    ...overrides,
  };
}

test("adverse HRSN barrier measures receive governed cross-sectional workspace views", () => {
  const policy = metricSemanticPolicyFor(definition("LACKTRPT:Crude"));
  assert.deepEqual(policy.allowedGeographyKinds, ["county"]);
  assert.equal(policy.trendable, false);
  assert.equal(policy.forecastable, false);
  assert.equal(policy.aggregatable, false);
  for (const view of [
    "choropleth",
    "ranked_dot",
    "scatterplot",
    "bivariate_map",
    "barrier_matrix",
    "service_gap",
  ]) {
    assert.ok(policy.allowedVisualizations.includes(view), `${view} should be governed for reviewed HRSN barriers`);
  }
  assert.equal(policy.allowedVisualizations.includes("density_heatmap"), false);
  assert.equal(policy.allowedVisualizations.includes("trend_line"), false);
});

test("official HRSA designation semantics support overlay and service-gap composition without becoming rankable", () => {
  for (const sourceMeasureId of ["HPSA_DESIGNATION", "MUA_P_DESIGNATION"]) {
    const policy = metricSemanticPolicyFor(definition(sourceMeasureId, {
      direction: "contextual",
      higherValueMeaning: "context_dependent",
      comparisonPolicy: "context_only",
      unit: "designation",
      universe: "Official HRSA designation records",
      adjustment: "not_applicable",
    }));
    assert.deepEqual(policy.allowedGeographyKinds, ["county"]);
    assert.ok(policy.allowedVisualizations.includes("designation_overlay"));
    assert.ok(policy.allowedVisualizations.includes("service_gap"));
    assert.equal(policy.allowedVisualizations.includes("ranked_dot"), false);
    assert.equal(policy.allowedVisualizations.includes("choropleth"), false);
    assert.equal(policy.trendable, false);
    assert.equal(policy.forecastable, false);
    assert.equal(policy.aggregatable, false);
  }
});

test("designation semantic mismatch fails closed", () => {
  const policy = metricSemanticPolicyFor(definition("HPSA_DESIGNATION", {
    direction: "adverse",
    higherValueMeaning: "adverse",
    comparisonPolicy: "higher_is_concern",
    unit: "designation",
  }));
  assert.deepEqual(policy, SAFE_UNCURATED_METRIC_POLICY);
});

test("disability remains contextual and does not receive barrier relationship permissions", () => {
  const policy = metricSemanticPolicyFor(definition("DISABILITY:Crude", {
    direction: "contextual",
    higherValueMeaning: "context_dependent",
    comparisonPolicy: "context_only",
  }));
  assert.ok(policy.allowedVisualizations.includes("choropleth"));
  assert.ok(policy.allowedVisualizations.includes("ranked_dot"));
  assert.equal(policy.allowedVisualizations.includes("scatterplot"), false);
  assert.equal(policy.allowedVisualizations.includes("bivariate_map"), false);
  assert.equal(policy.allowedVisualizations.includes("barrier_matrix"), false);
  assert.equal(policy.allowedVisualizations.includes("service_gap"), false);
});

test("semantic mismatch fails closed even for a known barrier measure", () => {
  const policy = metricSemanticPolicyFor(definition("LACKTRPT:Crude", {
    direction: "protective",
    higherValueMeaning: "favorable",
    comparisonPolicy: "lower_is_concern",
  }));
  assert.deepEqual(policy, SAFE_UNCURATED_METRIC_POLICY);
});

test("unknown measures receive no autonomous permissions", () => {
  const policy = metricSemanticPolicyFor(definition("NEW_UNREVIEWED:Crude"));
  assert.deepEqual(policy, SAFE_UNCURATED_METRIC_POLICY);
});

test("policy map is keyed by stable internal definition id while curation uses source identity", () => {
  const first = definition("LACKTRPT:Crude", { id: "uuid-like-definition-id" });
  const policies = buildMetricSemanticPolicies([first]);
  assert.ok(policies["uuid-like-definition-id"].allowedVisualizations.includes("choropleth"));
  assert.ok(policies["uuid-like-definition-id"].allowedVisualizations.includes("barrier_matrix"));
});
