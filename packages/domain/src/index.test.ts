import assert from "node:assert/strict";
import test from "node:test";
import { aggregateCountyRecords, canRouteConnection, canViewCountyIntelligence, countyAccessSeed, countyRecordsToCsv, filterCountyRecords } from "./index.ts";

test("suppresses small CB-CAP cells from metrics and exports", () => {
  const records = filterCountyRecords(countyAccessSeed, { state: "Kentucky", county: "Wayne County", zip: "All ZIP codes", period: "All periods", hubType: "All hub types", language: "All languages" });
  const aggregate = aggregateCountyRecords(records);
  const csv = countyRecordsToCsv(records);
  assert.equal(records.length, 2);
  assert.equal(aggregate.visible.length, 1);
  assert.equal(aggregate.suppressedCount, 1);
  assert.equal(aggregate.totalRequests, 104);
  assert.equal((csv.match(/42633/g) ?? []).length, 1);
  assert.doesNotMatch(csv, /Spanish/);
});

test("requires both state readiness and provider verification", () => {
  assert.equal(canRouteConnection("launch-ready", true), true);
  assert.equal(canRouteConnection("launch-ready", false), false);
  assert.equal(canRouteConnection("provider-verification", true), false);
});

test("keeps county intelligence interest-gated while preserving internal access", () => {
  assert.equal(canViewCountyIntelligence("internal-operator", false), true);
  assert.equal(canViewCountyIntelligence("county-admin", true), true);
  assert.equal(canViewCountyIntelligence("county-admin", false), false);
  assert.equal(canViewCountyIntelligence("resident", true), false);
});
