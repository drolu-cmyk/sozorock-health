import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../migrations/0015_source_coverage_product_scope.sql", import.meta.url),
  "utf8",
);
const foundationMigration = readFileSync(
  new URL("../migrations/0001_national_geography_evidence_foundation.sql", import.meta.url),
  "utf8",
);
const workforceMigration = readFileSync(
  new URL("../migrations/0007_national_context_store.sql", import.meta.url),
  "utf8",
);
const rollback = readFileSync(
  new URL("../migrations/rollback/0015_source_coverage_product_scope.down.sql", import.meta.url),
  "utf8",
);
const nationalContextLoader = readFileSync(
  new URL("../scripts/load-national-context-data-api.ts", import.meta.url),
  "utf8",
);
const productionBootstrap = readFileSync(
  new URL("../scripts/load-production-evidence-data-api.ts", import.meta.url),
  "utf8",
);

test("migration gives legacy coverage an explicit aggregate product key", () => {
  assert.match(
    migration,
    /coverage_key text NOT NULL DEFAULT 'source:all'/,
  );
  assert.match(
    migration,
    /PRIMARY KEY \(snapshot_id, geography_id, source_id, coverage_key\)/,
  );
});

test("migration normalizes coverage review state from operational status and verified source lineage", () => {
  assert.match(migration, /normalize_source_coverage_review_status/);
  assert.match(migration, /NEW\.status = 'stale'/);
  assert.match(migration, /NEW\.status IN \('available', 'partially_available'\)/);
  assert.match(migration, /source_review = 'verified'/);
  assert.match(migration, /NEW\.review_status := 'verified'/);
});

test("rollback refuses to collapse product-level rows and removes trigger dependencies first", () => {
  const guard = rollback.indexOf("HAVING count(*) > 1");
  const dropTrigger = rollback.indexOf("DROP TRIGGER IF EXISTS source_coverage_review_status_normalize");
  const dropColumns = rollback.indexOf("DROP COLUMN IF EXISTS coverage_key");

  assert.ok(guard >= 0, "rollback must fail closed when multiple product rows exist");
  assert.ok(dropTrigger >= 0, "rollback must remove the normalization trigger");
  assert.ok(dropColumns >= 0, "rollback must remove product-level columns only after safety checks");
  assert.ok(dropTrigger < dropColumns, "trigger must be removed before dependent columns");
  assert.match(
    rollback,
    /PRIMARY KEY \(snapshot_id, geography_id, source_id\)/,
  );
});

test("national context loader persists separate HPSA product coverage with verified review state", () => {
  for (const coverageKey of [
    "hpsa:primary_care",
    "hpsa:dental",
    "hpsa:mental_health",
  ]) {
    assert.ok(nationalContextLoader.includes(coverageKey), `missing ${coverageKey}`);
  }
  assert.match(
    nationalContextLoader,
    /ON CONFLICT \(snapshot_id, geography_id, source_id, coverage_key\) DO UPDATE SET/,
  );
  assert.match(nationalContextLoader, /reviewStatus: "verified"/);
  assert.match(nationalContextLoader, /complete_no_records/);
  assert.match(nationalContextLoader, /BatchExecuteStatementCommand/);
  assert.match(nationalContextLoader, /const BATCH_SIZE = 100/);
  assert.match(nationalContextLoader, /await flushAllBatches\(\)/);
  assert.match(
    nationalContextLoader,
    /ON CONFLICT \(source_id, release_label, content_hash\) DO UPDATE SET/,
  );
  assert.match(
    nationalContextLoader,
    /ON CONFLICT \(source_id, source_measure_id\) DO UPDATE SET/,
  );
  assert.match(
    nationalContextLoader,
    /ON CONFLICT \(source_version_id, source_record_id, geography_id\) DO UPDATE SET/,
  );
  assert.doesNotMatch(nationalContextLoader, /measure_family|definition_version|is_planning_metric/);
  assert.doesNotMatch(nationalContextLoader, /metric_observation[\s\S]*reviewed_by/);
  assert.match(foundationMigration, /UNIQUE \(source_id, release_label, content_hash\)/);
  assert.match(foundationMigration, /UNIQUE \(source_id, source_measure_id\)/);
  assert.match(
    workforceMigration,
    /UNIQUE \(source_version_id, source_record_id, geography_id\)/,
  );
});

test("legacy production bootstrap remains compatible through migration defaults without asserting verified negative HRSA coverage", () => {
  assert.doesNotMatch(
    productionBootstrap,
    /ON CONFLICT \(snapshot_id, geography_id, source_id\)/,
  );
  assert.match(productionBootstrap, /ON CONFLICT DO NOTHING/);
  assert.match(productionBootstrap, /"hrsa-workforce", null, "not_yet_verified"/);
  assert.doesNotMatch(productionBootstrap, /hpsa:primary_care/);
});
