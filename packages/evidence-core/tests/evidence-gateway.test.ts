import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PLACE_AGENT_EVALUATION_SNAPSHOT } from "../src/agent/evaluation-fixture.ts";
import {
  SHARED_EVIDENCE_CONTRACT_VERSION,
  buildEvidenceGatewayResponseV1,
} from "../src/evidence-gateway.ts";

const metricPolicies = {
  "measure:adverse-eval": {
    trendable: true,
    forecastable: false,
    aggregatable: false,
    allowedGeographyKinds: ["county" as const],
    allowedVisualizations: ["choropleth", "ranked_dot", "distribution"],
  },
};

const response = buildEvidenceGatewayResponseV1({
  releaseId: "evaluation-release-v1",
  generatedAt: "2026-08-22T22:00:00Z",
  evidenceCoreSchemaVersion: "evidence-core.contracts.v1",
  geographies: PLACE_AGENT_EVALUATION_SNAPSHOT.geographyCatalog.geographies,
  geographyRelationships: PLACE_AGENT_EVALUATION_SNAPSHOT.geographyCatalog.relationships,
  sourceCatalog: PLACE_AGENT_EVALUATION_SNAPSHOT.sourceCatalog,
  sourceVersions: PLACE_AGENT_EVALUATION_SNAPSHOT.sourceVersions,
  measureDefinitions: PLACE_AGENT_EVALUATION_SNAPSHOT.measureDefinitions,
  observations: PLACE_AGENT_EVALUATION_SNAPSHOT.observations,
  metricPolicies,
});

function byId<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing fixture item ${id}`);
  return item;
}

test("Evidence Gateway emits the locked version and release identity", () => {
  assert.equal(response.manifest.contract_version, SHARED_EVIDENCE_CONTRACT_VERSION);
  assert.equal(response.package.contract_version, SHARED_EVIDENCE_CONTRACT_VERSION);
  assert.equal(response.manifest.release_id, response.package.release_id);
  assert.match(response.manifest.release_hash, /^sha256:[a-f0-9]{64}$/);
});

test("Evidence Gateway preserves public value and provenance", () => {
  const albany = response.package.measures.find(
    (item) => item.id === "observation:albany-adverse",
  );
  assert.ok(albany);
  assert.equal(albany.numeric_value, 14);
  assert.equal(albany.geography.county_fips, "36001");
  assert.equal(albany.source_version.source_id, "cdc-places");
  assert.equal(
    albany.source_version.publisher,
    "Centers for Disease Control and Prevention",
  );
  assert.match(albany.source_version.content_hash, /^sha256:/);
});

test("metric behavior is fail-closed unless curated", () => {
  const adverse = response.package.metric_semantics.find(
    (item) => item.id === "measure:adverse-eval",
  );
  const protective = response.package.metric_semantics.find(
    (item) => item.id === "measure:protective-eval",
  );
  assert.ok(adverse);
  assert.ok(protective);

  assert.equal(adverse.trendable, true);
  assert.deepEqual(adverse.allowed_visualizations, [
    "choropleth",
    "ranked_dot",
    "distribution",
  ]);

  assert.equal(protective.trendable, false);
  assert.equal(protective.forecastable, false);
  assert.equal(protective.aggregatable, false);
  assert.deepEqual(protective.allowed_visualizations, []);
});

test("public Evidence Gateway does not emit CB-CAP private state", () => {
  const serialized = JSON.stringify(response.package);
  assert.equal(serialized.includes("tenant_id"), false);
  assert.equal(serialized.includes("funding_fit"), false);
  assert.equal(serialized.includes("agent_run"), false);
  assert.equal(serialized.includes("publication_approved"), false);
});

test("all initial evaluation counties remain represented", () => {
  const fips = new Set(
    response.package.geographies
      .filter((item) => item.kind === "county")
      .map((item) => item.county_fips),
  );

  for (const expected of ["36001", "36093", "36057", "42029", "48029"]) {
    assert.equal(fips.has(expected), true);
  }
});

test("canonical cross-repository fixture matches the serializer", () => {
  const albany = byId(
    PLACE_AGENT_EVALUATION_SNAPSHOT.geographyCatalog.geographies,
    "county:36001",
  );
  const sourceVersion = byId(
    PLACE_AGENT_EVALUATION_SNAPSHOT.sourceVersions,
    "source-version:cdc-places-current-eval",
  );
  const definition = byId(
    PLACE_AGENT_EVALUATION_SNAPSHOT.measureDefinitions,
    "measure:adverse-eval",
  );
  const observation = byId(
    PLACE_AGENT_EVALUATION_SNAPSHOT.observations,
    "observation:albany-adverse",
  );

  const canonical = buildEvidenceGatewayResponseV1({
    releaseId: "cross-repo-fixture-v1",
    generatedAt: "2026-08-22T22:00:00Z",
    evidenceCoreSchemaVersion: "evidence-core.contracts.v1",
    geographies: [albany],
    geographyRelationships: [],
    sourceCatalog: PLACE_AGENT_EVALUATION_SNAPSHOT.sourceCatalog,
    sourceVersions: [sourceVersion],
    measureDefinitions: [definition],
    observations: [observation],
    metricPolicies,
  });

  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/evidence-gateway-v1.json", import.meta.url),
      "utf8",
    ),
  );

  assert.deepEqual(canonical.package, fixture);
});
