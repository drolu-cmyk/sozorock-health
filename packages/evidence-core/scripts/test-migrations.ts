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
    "workforce_designation",
    "workspace_tenant", "county_workspace", "workspace_event", "workspace_participant",
    "planning_scenario", "planning_scenario_version", "funder_snapshot",
    "source_adapter_contract", "source_adapter_execution",
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

  let workspaceEventImmutableGuardPassed = false;
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO evidence.workspace_tenant (id, legal_name, status, created_at, created_by)
       VALUES ('22222222-2222-4222-a222-222222222222','Disposable test tenant','active',now(),'migration-test');
       INSERT INTO evidence.geography (
         id, kind, authority, authority_id, display_name, vintage, review_status,
         release_scope, geometry_status
       ) VALUES (
         '33333333-3333-4333-a333-333333333333','county','US_CENSUS','99001',
         'Disposable County','2025','verified','primary_50_states_dc','metadata_only'
       );
       INSERT INTO evidence.evidence_snapshot (
         id, name, content_hash, created_at, review_status, reviewed_by, reviewed_at, published_at
       ) VALUES (
         '44444444-4444-4444-a444-444444444444','Disposable snapshot',
         'sha256:${"b".repeat(64)}',now(),'verified','migration-test',now(),now()
       );
       INSERT INTO evidence.county_workspace (
         id, tenant_id, geography_id, evidence_snapshot_id, title, status,
         version, policy_version, created_at, created_by, updated_at
       ) VALUES (
         '55555555-5555-4555-a555-555555555555',
         '22222222-2222-4222-a222-222222222222',
         '33333333-3333-4333-a333-333333333333',
         '44444444-4444-4444-a444-444444444444',
         'Disposable workspace','active',1,'test',now(),'migration-test',now()
       );
       INSERT INTO evidence.workspace_event (
         id, workspace_id, tenant_id, sequence_number, event_type, actor_type,
         actor_id, idempotency_key, policy_version, outcome, occurred_at
       ) VALUES (
         '66666666-6666-4666-a666-666666666666',
         '55555555-5555-4555-a555-555555555555',
         '22222222-2222-4222-a222-222222222222',
         1,'workspace_created','human','migration-test','migration-test-1',
         'test','recorded',now()
       )`,
    );
    await client.query(
      "UPDATE evidence.workspace_event SET outcome='accepted' WHERE id='66666666-6666-4666-a666-666666666666'",
    );
  } catch (error) {
    workspaceEventImmutableGuardPassed = String(error).includes("immutable");
  } finally {
    await client.query("ROLLBACK");
  }
  if (!workspaceEventImmutableGuardPassed) {
    throw new Error("Immutable workspace-event trigger did not reject mutation.");
  }

  const down = await readFile(path.join(migrationsDir, "rollback", "0004_nationwide_evidence_activation.down.sql"), "utf8");
  await client.query(down);
  const rolledBack = await client.query("SELECT to_regclass('evidence.source_coverage') AS table_name");
  if (rolledBack.rows[0].table_name !== null) throw new Error("Migration 0004 rollback did not remove its source-coverage table.");
  const migration0004 = await readFile(path.join(migrationsDir, "0004_nationwide_evidence_activation.sql"), "utf8");
  await client.query(migration0004);
  const migration0005 = await readFile(path.join(migrationsDir, "0005_source_supersession_status.sql"), "utf8");
  await client.query(migration0005);
  const sourceStatuses = await client.query(
    "SELECT enumlabel FROM pg_enum WHERE enumtypid='evidence.source_coverage_status'::regtype ORDER BY enumsortorder",
  );
  if (!sourceStatuses.rows.some((row) => row.enumlabel === "superseded")) {
    throw new Error("Migration 0005 did not restore the superseded source status.");
  }
  const down0006 = await readFile(
    path.join(migrationsDir, "rollback", "0006_national_context_sources.down.sql"),
    "utf8",
  );
  await client.query(down0006);
  const rolledBackAhrq = await client.query(
    "SELECT enabled FROM evidence.capability_switch WHERE capability_key='source:ahrq_clh'",
  );
  if (rolledBackAhrq.rows[0]?.enabled !== false) {
    throw new Error("Migration 0006 rollback did not disable the AHRQ capability.");
  }
  const migration0006 = await readFile(path.join(migrationsDir, "0006_national_context_sources.sql"), "utf8");
  await client.query(migration0006);
  const contextCapabilities = await client.query(
    "SELECT capability_key, enabled FROM evidence.capability_switch WHERE capability_key IN ('source:acs','source:ahrf','source:ahrq_clh')",
  );
  if (
    contextCapabilities.rows.length !== 3
    || contextCapabilities.rows.some((row) => row.enabled !== true)
  ) {
    throw new Error("Migration 0006 did not restore all national context-source capabilities.");
  }
  const down0007 = await readFile(
    path.join(migrationsDir, "rollback", "0007_national_context_store.down.sql"),
    "utf8",
  );
  await client.query(down0007);
  const rolledBackWorkforce = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='evidence' AND table_name='workforce_designation'
    ) AS present`,
  );
  if (rolledBackWorkforce.rows[0].present !== false) {
    throw new Error("Migration 0007 rollback did not remove the workforce-designation table.");
  }
  const migration0007 = await readFile(path.join(migrationsDir, "0007_national_context_store.sql"), "utf8");
  await client.query(migration0007);
  const restoredWorkforce = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='evidence' AND table_name='workforce_designation'
    ) AS present`,
  );
  if (restoredWorkforce.rows[0].present !== true) {
    throw new Error("Migration 0007 did not restore the workforce-designation table.");
  }
  const down0008 = await readFile(
    path.join(migrationsDir, "rollback", "0008_explore_agentic_collaboration.down.sql"),
    "utf8",
  );
  await client.query(down0008);
  const rolledBackWorkspace = await client.query(
    "SELECT to_regclass('evidence.county_workspace') AS table_name",
  );
  if (rolledBackWorkspace.rows[0].table_name !== null) {
    throw new Error("Migration 0008 rollback did not remove the county-workspace table.");
  }
  const migration0008 = await readFile(
    path.join(migrationsDir, "0008_explore_agentic_collaboration.sql"),
    "utf8",
  );
  await client.query(migration0008);
  const restoredWorkspace = await client.query(
    "SELECT to_regclass('evidence.county_workspace') AS table_name",
  );
  if (restoredWorkspace.rows[0].table_name === null) {
    throw new Error("Migration 0008 did not restore the county-workspace table.");
  }

  console.log(JSON.stringify({
    migrations: await migrationFiles(),
    postgisVersion: postgis.rows[0].version,
    requiredTables,
    immutableGuardPassed,
    rollback0004Passed: true,
    reapply0004Passed: true,
    reapply0005Passed: true,
    rollback0006Passed: true,
    reapply0006Passed: true,
    rollback0007Passed: true,
    reapply0007Passed: true,
    workspaceEventImmutableGuardPassed,
    rollback0008Passed: true,
    reapply0008Passed: true,
  }, null, 2));
} finally {
  await client.end();
}
