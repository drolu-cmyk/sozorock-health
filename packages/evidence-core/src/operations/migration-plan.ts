export interface MigrationDescriptor {
  name: string;
  sha256: string;
}

export function planPendingMigrations<T extends MigrationDescriptor>(
  migrations: readonly T[],
  existingMigrations: ReadonlyMap<string, string>,
): T[] {
  for (const migration of migrations) {
    const priorHash = existingMigrations.get(migration.name);
    if (priorHash && priorHash !== migration.sha256) {
      throw new Error(`Migration integrity failure for ${migration.name}.`);
    }
  }

  return migrations.filter((migration) => !existingMigrations.has(migration.name));
}
