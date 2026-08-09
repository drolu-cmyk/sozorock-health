import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetricComparisons,
  roundComparisonDifference,
} from "../app/lib/explore-comparisons.ts";

test("Cook County colorectal screening uses the displayed state comparison", () => {
  const comparisons = buildMetricComparisons({
    localValue: 56.9,
    stateValue: 60.2,
    nationalValue: 63.8,
    higherValueMeaning: "favorable",
  });
  assert.equal(comparisons.displayedBasis, "state");
  assert.equal(comparisons.state.difference, -3.3);
  assert.equal(comparisons.state.sentence, "3.3 percentage points below the state comparison.");
  assert.equal(comparisons.national.difference, -6.9);
  assert.equal(comparisons.state.interpretation, "adverse_signal");
});

test("Cook County disability keeps state and national arithmetic separate", () => {
  const comparisons = buildMetricComparisons({
    localValue: 26.9,
    stateValue: 27.6,
    nationalValue: 30.4,
    higherValueMeaning: "adverse",
  });
  assert.equal(comparisons.state.difference, -0.7);
  assert.equal(comparisons.state.sentence, "0.7 percentage points below the state comparison.");
  assert.equal(comparisons.national.difference, -3.5);
});

test("difference always equals rounded local minus benchmark", () => {
  let seed = 0x5a17;
  for (let index = 0; index < 2_000; index += 1) {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    const local = (seed % 100_000) / 1_000;
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    const benchmark = (seed % 100_000) / 1_000;
    const comparisons = buildMetricComparisons({
      localValue: local,
      stateValue: benchmark,
      nationalValue: null,
      higherValueMeaning: "adverse",
    });
    assert.equal(comparisons.state.difference, roundComparisonDifference(local - benchmark));
  }
});

test("national becomes the displayed basis only when state is unavailable", () => {
  const comparisons = buildMetricComparisons({
    localValue: 12,
    stateValue: null,
    nationalValue: 10,
    higherValueMeaning: "adverse",
  });
  assert.equal(comparisons.displayedBasis, "national");
  assert.equal(comparisons.national.difference, 2);
  assert.equal(comparisons.state.difference, null);
});
