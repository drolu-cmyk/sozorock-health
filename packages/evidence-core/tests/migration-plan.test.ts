import test from "node:test";
import assert from "node:assert/strict";
import { planPendingMigrations } from "../src/operations/migration-plan.ts";

test("a resumed production migration applies only pending files", () => {
  const migrations = [
    { name: "0001_foundation.sql", sha256: "hash-1", sql: "SELECT 1" },
    { name: "0002_constraints.sql", sha256: "hash-2", sql: "ALTER TABLE example ADD CONSTRAINT example_check CHECK (true)" },
    { name: "0006_sources.sql", sha256: "hash-6", sql: "SELECT 6" },
    { name: "0007_store.sql", sha256: "hash-7", sql: "SELECT 7" },
  ];
  const existing = new Map([
    ["0001_foundation.sql", "hash-1"],
    ["0002_constraints.sql", "hash-2"],
  ]);

  assert.deepEqual(
    planPendingMigrations(migrations, existing).map((migration) => migration.name),
    ["0006_sources.sql", "0007_store.sql"],
  );
});

test("a resumed production migration fails closed on a changed historical hash", () => {
  assert.throws(
    () => planPendingMigrations(
      [{ name: "0002_constraints.sql", sha256: "new-hash" }],
      new Map([["0002_constraints.sql", "approved-hash"]]),
    ),
    /Migration integrity failure/,
  );
});
