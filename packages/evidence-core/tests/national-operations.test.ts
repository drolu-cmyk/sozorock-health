import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryPlaceAgentRepository,
  PLACE_AGENT_EVALUATION_SNAPSHOT,
  assessClaimForPublicUse,
  assessObservationForPublicUse,
  assessSourceFreshness,
  buildNationalOperationsReport,
  selectPrioritySignals,
  validateOperationalControl,
  type OperationalControl,
  type PlaceAcceptanceResult,
} from "../src/index.ts";

const now = "2026-07-22T17:00:00Z";
const repository = new InMemoryPlaceAgentRepository(PLACE_AGENT_EVALUATION_SNAPSHOT);

test("source freshness is deterministic and unavailable is not treated as zero", () => {
  assert.deepEqual(
    assessSourceFreshness({ lastSuccessfulImportAt: null, staleAfterDays: 3, now }),
    { status: "unavailable", ageDays: null, staleAfterDays: 3, label: "No successful import" },
  );
  assert.equal(
    assessSourceFreshness({
      lastSuccessfulImportAt: "2026-07-20T17:00:00Z",
      staleAfterDays: 3,
      now,
    }).status,
    "current",
  );
  assert.equal(
    assessSourceFreshness({
      lastSuccessfulImportAt: "2026-07-01T17:00:00Z",
      staleAfterDays: 3,
      now,
    }).status,
    "stale",
  );
});

test("public evidence requires exact geography, provenance, verification, and freshness", () => {
  const observation = PLACE_AGENT_EVALUATION_SNAPSHOT.observations.find(
    (item) => item.id === "observation:albany-adverse",
  );
  const measure = PLACE_AGENT_EVALUATION_SNAPSHOT.measureDefinitions.find(
    (item) => item.id === "measure:adverse-eval",
  );
  const sourceVersion = PLACE_AGENT_EVALUATION_SNAPSHOT.sourceVersions.find(
    (item) => item.id === observation?.sourceVersionId,
  );
  const geography = repository.getGeography("county:36001");
  assert.ok(observation && measure && sourceVersion && geography);

  assert.equal(
    assessObservationForPublicUse({
      selectedGeography: geography,
      observation,
      measure,
      sourceVersion,
      now,
    }).eligible,
    true,
  );

  const zcta = repository.getGeography("zcta:12207");
  assert.ok(zcta);
  const mismatch = assessObservationForPublicUse({
    selectedGeography: zcta,
    observation,
    measure,
    sourceVersion,
    now,
  });
  assert.equal(mismatch.eligible, false);
  assert.ok(mismatch.reasons.some((reason) => /does not match/i.test(reason)));
});

test("priority ranking excludes favorable measures and never returns more than five", () => {
  const signals = selectPrioritySignals({
    observations: PLACE_AGENT_EVALUATION_SNAPSHOT.observations,
    measures: PLACE_AGENT_EVALUATION_SNAPSHOT.measureDefinitions,
    selectedGeographyId: "county:36093",
    maximum: 10,
  });
  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.measure.id, "measure:adverse-eval");
  assert.notEqual(signals[0]?.measure.id, "measure:protective-eval");
});

test("a planning claim cannot publish without verified page or section citation", () => {
  const claim = PLACE_AGENT_EVALUATION_SNAPSHOT.claims[0];
  const citation = PLACE_AGENT_EVALUATION_SNAPSHOT.citations[0];
  assert.ok(claim && citation);
  assert.equal(assessClaimForPublicUse({ claim, citations: [citation] }).eligible, true);
  assert.equal(
    assessClaimForPublicUse({
      claim,
      citations: [{ ...citation, pageNumber: null, section: null }],
    }).eligible,
    false,
  );
});

test("any unresolved release-blocking control forces a no-go recommendation", () => {
  const controls: OperationalControl[] = [
    validateOperationalControl({
      id: "audited-store",
      domain: "evidence_governance",
      title: "Public route consumes the audited evidence store",
      status: "fail",
      releaseBlocking: true,
      evidence: ["Public route currently calls a source endpoint directly."],
      requiredAction: "Wire the route to the persistent evidence repository.",
    }),
  ];
  const places: PlaceAcceptanceResult[] = [{
    place: "Albany County, New York",
    countyFips: "36001",
    geographyResolved: true,
    publicDataStatus: "limited",
    localPlanStatus: "verified",
    agentSafetyStatus: "pass",
    publicReleaseStatus: "blocked",
    limitations: ["Production repository adapter is not configured."],
  }];
  const report = buildNationalOperationsReport({ evaluatedAt: now, controls, places });
  assert.equal(report.releaseRecommendation, "no_go");
  assert.deepEqual(report.blockingControlIds, ["audited-store"]);
});
