import type { AdapterBatch, IngestionRepository, StoredImport } from "./types.ts";

export class InMemoryIngestionRepository implements IngestionRepository {
  readonly imports = new Map<string, StoredImport>();

  async findImport(idempotencyKey: string) {
    return this.imports.get(idempotencyKey) ?? null;
  }

  async beginImport(record: StoredImport) {
    const existing = this.imports.get(record.idempotencyKey);
    if (existing && existing.status !== "failed") throw new Error("Duplicate ingestion idempotency key.");
    this.imports.set(record.idempotencyKey, structuredClone(record));
  }

  async publishBatch(record: StoredImport, batch: AdapterBatch) {
    const existing = this.imports.get(record.idempotencyKey);
    if (!existing) throw new Error("Cannot publish an ingestion run that has not started.");
    this.imports.set(record.idempotencyKey, {
      ...existing,
      status: batch.status,
      successfulImportAt: batch.status === "available" || batch.status === "stale" ? record.successfulImportAt : null,
      sourceVersion: batch.sourceVersion,
      measures: structuredClone(batch.measures),
      observations: structuredClone(batch.observations),
      recordsRead: batch.recordsRead,
      recordsAccepted: batch.recordsAccepted,
      recordsRejected: batch.recordsRejected,
      observationsPublished: batch.observations.length,
      cacheDisposition: batch.cacheDisposition,
      failureMessage: batch.statusReason,
    });
  }

  async failImport(idempotencyKey: string, failedAt: string, code: string, message: string) {
    const existing = this.imports.get(idempotencyKey);
    if (!existing) throw new Error("Cannot fail an ingestion run that has not started.");
    this.imports.set(idempotencyKey, {
      ...existing,
      status: "failed",
      failedAt,
      failureCode: code,
      failureMessage: message,
    });
  }
}
