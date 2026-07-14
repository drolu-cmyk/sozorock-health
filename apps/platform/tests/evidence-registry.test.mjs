import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const registry = JSON.parse(await readFile(
  new URL("../data/evidence-registry.json", import.meta.url),
  "utf8",
));
const manifest = JSON.parse(await readFile(
  new URL("../data/source-manifest.json", import.meta.url),
  "utf8",
));

test("publishes a complete, distinguishable nationwide geography contract", () => {
  assert.equal(registry.geographySearch.statesAndDistrictOfColumbia.count, 51);
  assert.equal(registry.geographySearch.countyEquivalents.count, 3144);
  assert.equal(registry.geographySearch.placesAndCities.status, "authoritative-on-demand");
  assert.equal(registry.geographySearch.townsAndLocalities.status, "authoritative-on-demand");
  assert.equal(registry.geographySearch.zipLinkedAreas.label, "Census ZCTA");
  assert.match(registry.geographySearch.zipLinkedAreas.boundary, /not a USPS delivery route/i);
  assert.ok(registry.sources.some(({ id, integrationStatus }) => (
    id === "usgs-gnis-populated-places" && integrationStatus === "integrated-on-demand"
  )));
});

test("keeps current evidence and future official sources visibly separate", () => {
  const ids = registry.sources.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  for (const source of registry.sources) {
    const url = new URL(source.officialUrl);
    assert.equal(url.protocol, "https:");
    assert.ok(url.hostname.endsWith(".gov"));
    assert.ok(source.limitations.length > 0);
    if (source.integrationStatus === "planned-ingestion") {
      assert.equal(source.coverage.status, "planned-not-displayed", source.id);
      assert.match(source.freshness.cadence, /not yet ingested/i, source.id);
    }
  }

  const county = registry.sources.find(({ id }) => id === "cdc-places-county-2025");
  assert.equal(county.coverage.numerator, manifest.indicators.matchedCountyCount);
  assert.equal(county.coverage.denominator, manifest.quality.actualCountyEquivalents);
  assert.equal(county.freshness.snapshotGeneratedAt, manifest.generatedAt);
  assert.equal(registry.sources.find(({ id }) => id === "hrsa-ahrf-2026").integrationStatus, "planned-ingestion");
  assert.equal(registry.sources.find(({ id }) => id === "hrsa-shortage-areas").integrationStatus, "planned-ingestion");
});

test("defines barriers, system capacity, and disability context without conflation", () => {
  const disability = registry.barrierTaxonomy.find(({ id }) => id === "accessibility");
  assert.equal(disability.classification, "accessibility-context");
  assert.deepEqual(disability.measureKeys, ["disability"]);
  assert.match(disability.boundary, /not barriers/i);

  const planned = registry.barrierTaxonomy.filter(({ evidenceStatus }) => evidenceStatus === "planned-not-displayed");
  assert.ok(planned.length >= 3);
  assert.ok(planned.every(({ measureKeys }) => measureKeys.length === 0));
  assert.ok(planned.some(({ id }) => id === "workforce-and-service-capacity"));
  assert.ok(planned.some(({ id }) => id === "digital-connectivity"));
});

test("frames CHA and CHIP as accountable human planning, not an automated decision", () => {
  assert.deepEqual(
    registry.chaChipSupport.stages.map(({ id }) => id),
    ["assess", "validate", "prioritize", "act", "measure"],
  );
  assert.match(registry.chaChipSupport.boundary, /does not decide priorities/i);
  assert.match(registry.chaChipSupport.boundary, /does not.*replace.*official CHA.*official CHIP/i);
  assert.equal(registry.workforceReadiness.status, "architecture-ready-data-not-integrated");
  assert.ok(registry.workforceReadiness.dimensions.every(({ status }) => status === "planned-not-displayed"));
});

test("keeps forecasting claims inside a bounded scenario policy", () => {
  assert.equal(registry.scenarioPolicy.classification, "bounded-planning-scenario");
  assert.ok(registry.scenarioPolicy.prohibited.some((line) => /Predict individual health outcomes/i.test(line)));
  assert.ok(registry.scenarioPolicy.prohibited.some((line) => /observed count/i.test(line)));
  assert.ok(registry.scenarioPolicy.prohibited.some((line) => /missing or suppressed data into zero/i.test(line)));
  assert.match(registry.scenarioPolicy.humanReview, /before acting/i);
});

test("encodes the systems-intelligence maturity and traceability contract without overstating the release", () => {
  assert.deepEqual(
    registry.systemsIntelligence.traceability.sequence,
    ["Evidence", "Interpretation", "Lever"],
  );
  assert.deepEqual(
    registry.systemsIntelligence.maturityModel.stages,
    [
      "Data Capture",
      "Operational Execution",
      "Structured Integration",
      "Systems Intelligence",
      "Institutional Intelligence",
    ],
  );
  assert.deepEqual(
    registry.systemsIntelligence.maturityModel.tiers,
    ["Foundational", "Integrative", "Adaptive"],
  );
  assert.equal(registry.systemsIntelligence.maturityModel.currentPublicRelease, "Structured Integration");
  assert.match(registry.systemsIntelligence.maturityModel.boundary, /does not claim full systems or institutional intelligence/i);
  for (const key of ["sourceIds", "method", "limitations", "status", "humanReview"]) {
    assert.ok(registry.systemsIntelligence.traceability.requiredDerivedInsightFields.includes(key));
  }
  const components = new Map(registry.systemsIntelligence.operatingComponents.map((item) => [item.id, item]));
  assert.equal(components.get("governed-data-architecture").status, "current-foundation");
  assert.equal(components.get("feedback-loop").status, "planned-not-displayed");
  assert.equal(components.get("workforce-capability").status, "planned-not-displayed");
});

test("exposes the registry through a cacheable, release-checked API", async () => {
  const route = await readFile(new URL("../app/api/evidence/route.ts", import.meta.url), "utf8");
  const validator = await readFile(new URL("../app/lib/evidence-registry.ts", import.meta.url), "utf8");
  assert.match(route, /validateEvidenceRegistry/);
  assert.match(route, /s-maxage=86400/);
  assert.match(validator, /CDC county registry lineage must match/);
  assert.match(validator, /official public \.gov URL/);
});
