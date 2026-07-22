import assert from "node:assert/strict";
import test from "node:test";
import {
  isConcernSignal,
  PARTNER_EVIDENCE_REVIEW_CASES,
  publicCaseForAction,
  publishablePlanningClaims,
  validateCaseForAction,
} from "../src/index.ts";

test("review cases are valid, editable, and remain review-only", () => {
  for (const value of Object.values(PARTNER_EVIDENCE_REVIEW_CASES)) {
    assert.deepEqual(validateCaseForAction(value), []);
    assert.equal(value.releaseStatus, "review_only");
    assert.equal(value.editable, true);
  }
});

test("provisional local-plan claims never enter the public case", () => {
  for (const value of Object.values(PARTNER_EVIDENCE_REVIEW_CASES)) {
    assert.equal(publishablePlanningClaims(value).length, 0);
    const publicValue = publicCaseForAction(value);
    assert.equal("internalReview" in publicValue, false);
    assert.equal(publicValue.localPlan.verifiedAlignment.length, 0);
  }
});

test("a favorable preventive-service measure is not treated as a problem", () => {
  const albanyScreening = PARTNER_EVIDENCE_REVIEW_CASES.albany.publicData.signals.find((item) => item.id === "albany-colorectal-screening");
  assert.ok(albanyScreening);
  assert.equal(albanyScreening.direction, "protective");
  assert.equal(albanyScreening.interpretation, "favorable_signal");
  assert.equal(isConcernSignal(albanyScreening), false);
});

test("Bexar has a sourced barrier but still requires local partner review", () => {
  const value = PARTNER_EVIDENCE_REVIEW_CASES.bexar;
  assert.equal(value.practicalBarriers.length, 1);
  assert.equal(value.practicalBarriers[0].signalId, "bexar-uninsured");
  assert.equal(value.responseConcept.status, "requires local partner review");
  assert.equal(value.resourceCoverage.resources.length, 0);
});

test("Albany does not invent an intervention case when verified evidence is incomplete", () => {
  const value = PARTNER_EVIDENCE_REVIEW_CASES.albany;
  assert.equal(value.responseConcept.status, "insufficient evidence");
  assert.equal(value.responseConcept.responseType, null);
  assert.equal(value.practicalBarriers.length, 0);
});

test("every public-data signal preserves exact geography and source dates", () => {
  for (const value of Object.values(PARTNER_EVIDENCE_REVIEW_CASES)) {
    for (const signal of value.publicData.signals) {
      assert.equal(signal.geographyId, value.place.geographyId);
      assert.equal(signal.geographyLevel, "county");
      assert.ok(signal.releaseDate);
      assert.ok(signal.dataPeriod);
      assert.ok(signal.retrievedAt);
      assert.ok(value.sources.some((source) => source.id === signal.sourceId));
    }
  }
});
