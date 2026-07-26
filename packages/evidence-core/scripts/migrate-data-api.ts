import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BeginTransactionCommand,
  CommitTransactionCommand,
  ExecuteStatementCommand,
  RDSDataClient,
  RollbackTransactionCommand,
} from "@aws-sdk/client-rds-data";
import { splitPostgresStatements } from "../src/operations/sql-splitter.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "migrations");
const resourceArn = process.env.EVIDENCE_DATABASE_CLUSTER_ARN?.trim();
const secretArn = process.env.EVIDENCE_DATABASE_SECRET_ARN?.trim();
const database = process.env.EVIDENCE_DATABASE_NAME?.trim();
const approvedTarget = process.env.EVIDENCE_EXPECTED_CLUSTER_ARN?.trim();
if (!resourceArn || !secretArn || !database) throw new Error("Evidence Data API configuration is incomplete.");
if (process.env.EVIDENCE_PRODUCTION_MIGRATION_APPROVED !== "true") {
  throw new Error("Production migration approval flag is required.");
}
if (!approvedTarget || approvedTarget !== resourceArn) {
  throw new Error("The resolved database cluster does not match the approved migration target.");
}

const client = new RDSDataClient({});
const base = { resourceArn, secretArn, database };

async function migrationFiles() {
  return (await readdir(migrationsDirectory))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

async function query(sql: string, transactionId?: string) {
  return client.send(new ExecuteStatementCommand({
    ...base,
    sql,
    transactionId,
    continueAfterTimeout: true,
  }));
}

const identity = await query("SELECT current_database()::text, current_user::text, version()::text");
if (!identity.records?.[0]) throw new Error("The production database target could not be identified.");

const files = await migrationFiles();
const migrations = await Promise.all(files.map(async (name) => {
  const sql = await readFile(path.join(migrationsDirectory, name), "utf8");
  return { name, sql, sha256: createHash("sha256").update(sql).digest("hex") };
}));

let existingMigrations = new Map<string, string>();
try {
  const existing = await query("SELECT migration_name, sha256 FROM evidence.schema_migration ORDER BY migration_name");
  existingMigrations = new Map((existing.records ?? []).map((row) => [
    row[0]?.stringValue ?? "",
    row[1]?.stringValue ?? "",
  ]));
} catch (error) {
  if (!String(error).includes("schema_migration")) throw error;
}
for (const migration of migrations) {
  const prior = existingMigrations.get(migration.name);
  if (prior && prior !== migration.sha256) {
    throw new Error(`Migration integrity failure for ${migration.name}.`);
  }
}
if (migrations.every((migration) => existingMigrations.get(migration.name) === migration.sha256)) {
  console.log(JSON.stringify({
    target: { resourceArn, database },
    migrations: migrations.map(({ name, sha256 }) => ({ name, sha256 })),
    applied: false,
    reason: "All approved migration hashes are already present.",
  }, null, 2));
  process.exit(0);
}

let transactionId: string | undefined;
try {
  transactionId = (await client.send(new BeginTransactionCommand(base))).transactionId;
  if (!transactionId) throw new Error("RDS Data API did not start a migration transaction.");
  for (const migration of migrations) {
    for (const statement of splitPostgresStatements(migration.sql)) {
      await query(statement, transactionId);
    }
  }
  for (const migration of migrations) {
    if (existingMigrations.has(migration.name)) continue;
    await client.send(new ExecuteStatementCommand({
      ...base,
      transactionId,
      sql: `INSERT INTO evidence.schema_migration (migration_name, sha256, applied_at, applied_by)
            VALUES (:name, :sha256, now(), :applied_by)`,
      parameters: [
        { name: "name", value: { stringValue: migration.name } },
        { name: "sha256", value: { stringValue: migration.sha256 } },
        { name: "applied_by", value: { stringValue: process.env.GITHUB_SHA || "approved-production-migration" } },
      ],
    }));
    const check = await client.send(new ExecuteStatementCommand({
      ...base,
      transactionId,
      sql: "SELECT sha256 FROM evidence.schema_migration WHERE migration_name=:name",
      parameters: [{ name: "name", value: { stringValue: migration.name } }],
    }));
    if (check.records?.[0]?.[0]?.stringValue !== migration.sha256) {
      throw new Error(`Migration integrity failure for ${migration.name}.`);
    }
  }
  await client.send(new CommitTransactionCommand({ ...base, transactionId }));
  console.log(JSON.stringify({
    target: { resourceArn, database },
    migrations: migrations.map(({ name, sha256 }) => ({ name, sha256 })),
    applied: true,
  }, null, 2));
} catch (error) {
  if (transactionId) {
    await client.send(new RollbackTransactionCommand({ ...base, transactionId })).catch(() => undefined);
  }
  throw error;
}
