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
    "workspace_share_link", "workspace_handoff", "explore_onboarding_request",
    "explore_usage_event", "explore_performance_sample", "source_change_proposal",
    "entity_ip_readiness_check",
  ];
  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='evidence'",
  );
  const existing = new Set(tables.rows.map((row) => row.table_name));
  const missing = requiredTables.filter((name) => !existing.has(name));
  if (missing.length) throw new Error(`Missing migrated tables: ${missing.join(", ")}`);
  const publicQuestionColumn = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='evidence' AND table_name='workspace_review_question'
       AND column_name='is_public'`,
  );
  if (publicQuestionColumn.rows.length !== 1) {
    throw new Error("Migration 0013 did not add the explicit public review-question flag.");
  }

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
  let workspaceEventMutationError: unknown = null;
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO evidence.workspace_tenant (id, legal_name, status, created_at, created_by)
       VALUES ('22222222-2222-4222-a222-222222222222','Disposable test tenant','active',now(),'migration-test');
       INSERT INTO evidence.geography (
         id, kind, authority, authority_id, name, display_name, state_fips,
         county_fips, vintage, review_status, release_scope, geometry_status
       ) VALUES (
         '33333333-3333-4333-a333-333333333333','county','census','99001',
         'Disposable County','Disposable County','99','99001','2025','verified',
         'primary_50_states_dc','metadata_only'
       );
       INSERT INTO evidence.evidence_snapshot (
         id, contract_version, policy_version, content_hash, created_at,
         review_status, reviewed_by, reviewed_at, published_at
       ) VALUES (
         '44444444-4444-4444-a444-444444444444','test.snapshot.v1','test-policy',
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
    workspaceEventMutationError = error;
    workspaceEventImmutableGuardPassed = String(error).includes("immutable");
  } finally {
    await client.query("ROLLBACK");
  }
  if (!workspaceEventImmutableGuardPassed) {
    throw new Error(
      `Immutable workspace-event trigger did not reject mutation. Received: ${String(workspaceEventMutationError)}`,
    );
  }

  // The latest correctness migrations must be reversible and re-applicable in
  // the disposable database before any protected environment is touched.
  const down0014 = await readFile(
    path.join(migrationsDir, "rollback", "0014_workspace_publication_controls.down.sql"),
    "utf8",
  );
  await client.query(down0014);
  const publicationControlsAfter0014Rollback = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='evidence' AND table_name='workspace_section'
       AND column_name IN ('publication_status','published_by','published_at')`,
  );
  if (publicationControlsAfter0014Rollback.rows.length !== 0) {
    throw new Error("Migration 0014 rollback did not remove publication controls.");
  }
  const publicSharingAfter0014Rollback = await client.query(
    "SELECT 1 FROM evidence.capability_switch WHERE capability_key='explore:public-sharing'",
  );
  if (publicSharingAfter0014Rollback.rows.length !== 0) {
    throw new Error("Migration 0014 rollback did not remove the public-sharing capability.");
  }
  await client.query(await readFile(path.join(migrationsDir, "0014_workspace_publication_controls.sql"), "utf8"));
  const publicationControlsAfter0014Reapply = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='evidence' AND table_name='workspace_section'
       AND column_name IN ('publication_status','published_by','published_at')`,
  );
  if (publicationControlsAfter0014Reapply.rows.length !== 3) {
    throw new Error("Migration 0014 did not restore all publication controls.");
  }
  const publicSharingAfter0014Reapply = await client.query(
    "SELECT enabled FROM evidence.capability_switch WHERE capability_key='explore:public-sharing'",
  );
  if (publicSharingAfter0014Reapply.rows[0]?.enabled !== false) {
    throw new Error("Migration 0014 did not restore public sharing in the disabled state.");
  }

  const down0012 = await readFile(path.join(migrationsDir, "rollback", "0012_acs_provenance_backfill.down.sql"), "utf8");
  const down0013 = await readFile(path.join(migrationsDir, "rollback", "0013_public_review_questions.down.sql"), "utf8");
  await client.query(down0013);
  const publicQuestionAfter0013Rollback = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='evidence' AND table_name='workspace_review_question'
       AND column_name='is_public'`,
  );
  if (publicQuestionAfter0013Rollback.rows.length !== 0) {
    throw new Error("Migration 0013 rollback did not remove the public review-question flag.");
  }
  await client.query(await readFile(path.join(migrationsDir, "0013_public_review_questions.sql"), "utf8"));
  await client.query(down0012);
  const provenanceAfter0012Rollback = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='evidence' AND table_name='metric_observation'
       AND column_name IN ('source_variable_id','source_numerator_variable_id','source_denominator_variable_id')`,
  );
  if (provenanceAfter0012Rollback.rows.length !== 3) {
    throw new Error("Migration 0012 rollback unexpectedly removed the field-level provenance schema.");
  }
  await client.query(await readFile(path.join(migrationsDir, "0012_acs_provenance_backfill.sql"), "utf8"));

  const down0011 = await readFile(path.join(migrationsDir, "rollback", "0011_workspace_recipient_binding.down.sql"), "utf8");
  await client.query(down0011);
  const recipientColumns = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='evidence' AND table_name IN ('workspace_invitation','workspace_handoff')
       AND column_name IN ('intended_principal_id','target_principal_id')`,
  );
  if (recipientColumns.rows.length !== 0) throw new Error("Migration 0011 rollback did not remove recipient bindings.");
  await client.query(await readFile(path.join(migrationsDir, "0011_workspace_recipient_binding.sql"), "utf8"));

  const down0010 = await readFile(path.join(migrationsDir, "rollback", "0010_field_level_provenance.down.sql"), "utf8");
  await client.query(down0010);
  const provenanceColumns = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='evidence' AND table_name='metric_observation'
       AND column_name='source_variable_id'`,
  );
  if (provenanceColumns.rows.length !== 0) throw new Error("Migration 0010 rollback did not remove ACS provenance columns.");
  await client.query(await readFile(path.join(migrationsDir, "0010_field_level_provenance.sql"), "utf8"));

  // Roll back the newest dependent schemas first. Migration 0009 extends the
  // 0008 workspace tables, so it must be removed before 0008 is exercised.
  const down0009 = await readFile(
    path.join(migrationsDir, "rollback", "0009_explore_agentic_operations.down.sql"),
    "utf8",
  );
  await client.query(down0009);
  const rolledBackAdvanced = await client.query(
    "SELECT to_regclass('evidence.workspace_share_link') AS table_name",
  );
  if (rolledBackAdvanced.rows[0].table_name !== null) {
    throw new Error("Migration 0009 rollback did not remove advanced Explore tables.");
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

  const migration0009 = await readFile(
    path.join(migrationsDir, "0009_explore_agentic_operations.sql"),
    "utf8",
  );
  await client.query(migration0009);
  const advancedTables = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='evidence' AND table_name IN (
       'workspace_share_link','workspace_handoff','explore_onboarding_request',
       'explore_usage_event','explore_performance_sample','source_change_proposal',
       'entity_ip_readiness_check'
     )`,
  );
  if (advancedTables.rows.length !== 7) {
    throw new Error("Migration 0009 did not restore all advanced Explore tables.");
  }
  await client.query(migration0009);

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
    rollback0009Passed: true,
    reapply0009Passed: true,
    rollback0012Passed: true,
    reapply0012Passed: true,
    rollback0013Passed: true,
    reapply0013Passed: true,
    rollback0014Passed: true,
    reapply0014Passed: true,
  }, null, 2));
} finally {
  await client.end();
}
