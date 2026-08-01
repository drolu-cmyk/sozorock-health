import assert from "node:assert/strict";
import test from "node:test";
import { cdcMeasureDefinitionId, indexCdcObservations } from "../app/lib/explore-cdc-metadata.ts";

const observation = (sourceMeasureId, label, sourceVersionId = "cdc-release") => ({
  id: `observation:${sourceMeasureId}`,
  measureDefinitionId: cdcMeasureDefinitionId(sourceMeasureId),
  label,
  direction: "adverse",
  unit: "percent",
  universe: sourceMeasureId === "COPD" ? "Adults who report being told they have COPD" : "Eligible adult population",
  adjustment: "Crude prevalence",
  value: 8.4,
  confidence: { low: 7.1, high: 9.8, marginOfError: null },
  geographyId: "county:51059",
  sourceVersionId,
  releaseDate: "2025-12-04",
  dataPeriod: { start: "2022-01-01", end: "2023-12-31" },
  reviewStatus: "verified",
  interpretation: "not_rankable",
  benchmarkObservationId: null,
  citationIds: [],
});

test("COPD metadata resolves by canonical measure definition rather than display label", () => {
  const index = indexCdcObservations([
    observation("COPD", "Chronic obstructive pulmonary disease"),
    observation("DIABETES", "Diabetes"),
  ], "cdc-release");
  const copd = index.get(cdcMeasureDefinitionId("COPD"));
  assert.equal(copd?.label, "Chronic obstructive pulmonary disease");
  assert.equal(copd?.universe, "Adults who report being told they have COPD");
  assert.equal(copd?.adjustment, "Crude prevalence");
  assert.deepEqual(copd?.dataPeriod, { start: "2022-01-01", end: "2023-12-31" });
  assert.equal(copd?.releaseDate, "2025-12-04");
  assert.deepEqual(copd?.confidence, { low: 7.1, high: 9.8, marginOfError: null });
  assert.equal(index.get(cdcMeasureDefinitionId("Chronic obstructive pulmonary disease")), undefined);
});

test("all source measures remain stable when presentation labels differ", () => {
  const cases = [
    ["COLON_SCREEN", "Colorectal cancer screening"],
    ["MAMMOUSE", "Mammography use"],
    ["CASTHMA", "Current asthma"],
    ["ACCESS2", "Adults without health insurance"],
  ];
  const index = indexCdcObservations(cases.map(([id, label]) => observation(id, label)), "cdc-release");
  for (const [id, label] of cases) {
    assert.equal(index.get(cdcMeasureDefinitionId(id))?.label, label);
    assert.equal(index.get(cdcMeasureDefinitionId(label)), undefined);
  }
});

test("metadata from another source release cannot be joined into CDC output", () => {
  const index = indexCdcObservations([observation("COPD", "Chronic obstructive pulmonary disease", "other-release")], "cdc-release");
  assert.equal(index.size, 0);
});
