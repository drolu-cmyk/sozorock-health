import assert from "node:assert/strict";
import test from "node:test";
import { buildPlaceIntelligence } from "../app/lib/place-intelligence.ts";

const location = {
  kind: "county",
  geoid: "36025",
  label: "Delaware County, NY",
  state: "NY",
  population: 44000,
};

function metric(overrides = {}) {
  return {
    key: "diabetes",
    label: "Diabetes",
    category: "Chronic conditions",
    plainLanguage: "Estimated diagnosed diabetes prevalence.",
    response: "Support education and readiness.",
    value: 16,
    national: 10,
    state: 11,
    difference: 6,
    score: 20,
    release: "2025",
    ...overrides,
  };
}

test("supports a Health Access Day only when strong signals and a practical barrier are present", () => {
  const metrics = [
    metric(),
    metric({ key: "bphigh", label: "High blood pressure", value: 41, national: 34, difference: 7 }),
    metric({ key: "lacktrpt", label: "Lack of reliable transportation", category: "Access barriers", value: 13, national: 8, difference: 5 }),
  ];
  const result = buildPlaceIntelligence({ location, metrics, priorities: metrics, localPlan: null });
  assert.equal(result.healthAccessDay.status, "Supported");
  assert.match(result.healthAccessDay.statement, /supports considering a Health Access Day/);
  assert.equal(result.practicalBarriers[0].status, "Supported");
});

test("keeps a single strong signal in potentially supported status", () => {
  const metrics = [metric()];
  const result = buildPlaceIntelligence({ location, metrics, priorities: metrics, localPlan: null });
  assert.equal(result.healthAccessDay.status, "Potentially supported");
  assert.match(result.evidenceBasis, /local CHA\/CHIP source not yet available/);
});

test("does not invent a practical barrier when compatible measures are absent", () => {
  const metrics = [metric({ value: 11, national: 10, difference: 1 })];
  const result = buildPlaceIntelligence({ location, metrics, priorities: metrics, localPlan: null });
  assert.equal(result.healthAccessDay.status, "Insufficient evidence");
  assert.equal(result.practicalBarriers[0].title, "Practical barrier coverage");
  assert.match(result.practicalBarriers[0].statement, /No compatible place-level practical-barrier measure/);
});

test("keeps workforce action closed without a location-specific workforce value", () => {
  const metrics = [metric()];
  const result = buildPlaceIntelligence({ location, metrics, priorities: metrics, localPlan: null });
  const workforce = result.placeBasedResponses.find((item) => item.name === "Workforce capacity");
  assert.equal(workforce?.status, "Insufficient evidence");
  assert.match(workforce?.evidence ?? "", /no location-specific workforce value/i);
});

test("does not repeat a measure in Health Access Day evidence", () => {
  const metrics = [
    metric({
      key: "access2",
      label: "Adults without health insurance",
      category: "Access barriers",
      value: 21,
      national: 9,
      difference: 12,
    }),
  ];
  const result = buildPlaceIntelligence({ location, metrics, priorities: metrics, localPlan: null });
  const matchingReasons = result.healthAccessDay.reasons.filter((reason) =>
    reason.startsWith("Adults without health insurance:"),
  );
  assert.equal(matchingReasons.length, 1);
});
