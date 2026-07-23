import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(packageRoot, "migrations");
const connectionString = process.env.EVIDENCE_DATABASE_URL;
if (!connectionString) throw new Error("EVIDENCE_DATABASE_URL is required for migration validation.");
if (process.env.EVIDENCE_MIGRATION_TEST_DISPOSABLE !== "true") {
  throw new Error("Migration test refuses to run unless EVIDENCE_MIGRATION_TEST_DISPOSABLE=true.");
}

const client = new pg.Client({
  connectionString,
  ssl: process.env.EVIDENCE_DATABASE_SSL === "disable" ? false : { rejectUnauthorized: true },
  application_name: "sozorock-migration-test",
});
await client.connect();

async function migrationFiles() {
  return (await readdir(migrationsDir))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

async function applyAll() {
  const files = await migrationFiles();
  for (const name of files) {
    const sql = await readFile(path.join(migrationsDir, name), "utf8");
    await client.query(sql);
  }
  for (const name of files) {
    const sql = await readFile(path.join(migrationsDir, name), "utf8");
    const sha256 = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      "SELECT sha256 FROM evidence.schema_migration WHERE migration_name=$1",
      [name],
    );
    if (existing.rows[0] && existing.rows[0].sha256 !== sha256) {
      throw new Error(`Migration integrity failure for ${name}.`);
    }
    if (!existing.rows[0]) {
      await client.query(
        "INSERT INTO evidence.schema_migration (migration_name, sha256, applied_at, applied_by) VALUES ($1,$2,now(),$3)",
        [name, sha256, "milestone-8-disposable-test"],
      );
    }
  }
}

try {
  await applyAll();
  const postgis = await client.query("SELECT postgis_version() AS version");
  const requiredTables = [
    "geography", "source_catalog", "source_version", "metric_observation",
    "source_import_state", "planning_document_candidate", "source_coverage",
    "import_manifest", "source_health_event", "execution_audit", "capability_switch",
    "schema_migration",
  ];
  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='evidence'",
  );
  const existing = new Set(tables.rows.map((row) => row.table_name));
  const missing = requiredTables.filter((name) => !existing.has(name));
  if (missing.length) throw new Error(`Missing migrated tables: ${missing.join(", ")}`);

  let immutableGuardPassed = false;
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO evidence.execution_audit (
        id, execution_type, contract_version, policy_version, request_hash,
        outcome, reason, occurred_at
      ) VALUES ('11111111-1111-4111-a111-111111111111','refresh','test','test',
        'sha256:${"a".repeat(64)}','succeeded','migration guard test',now())`,
    );
    await client.query(
      "UPDATE evidence.execution_audit SET reason='mutation should fail' WHERE id='11111111-1111-4111-a111-111111111111'",
    );
  } catch (error) {
    immutableGuardPassed = String(error).includes("immutable");
  } finally {
    await client.query("ROLLBACK");
  }
  if (!immutableGuardPassed) throw new Error("Immutable execution-audit trigger did not reject mutation.");

  const down = await readFile(path.join(migrationsDir, "rollback", "0004_nationwide_evidence_activation.down.sql"), "utf8");
  await client.query(down);
  const rolledBack = await client.query("SELECT to_regclass('evidence.source_coverage') AS table_name");
  if (rolledBack.rows[0].table_name !== null) throw new Error("Migration 0004 rollback did not remove its source-coverage table.");
  const migration0004 = await readFile(path.join(migrationsDir, "0004_nationwide_evidence_activation.sql"), "utf8");
  await client.query(migration0004);

  console.log(JSON.stringify({
    migrations: await migrationFiles(),
    postgisVersion: postgis.rows[0].version,
    requiredTables,
    immutableGuardPassed,
    rollback0004Passed: true,
    reapply0004Passed: true,
  }, null, 2));
} finally {
  await client.end();
}
