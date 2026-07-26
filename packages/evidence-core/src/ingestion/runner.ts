import type { Geography } from "../contracts.ts";
import { deterministicUuid, sha256 } from "./hash.ts";
import type {
  AdapterContext,
  IngestionRepository,
  IngestionResult,
  PublicDataAdapter,
  SourceQuery,
  StoredImport,
} from "./types.ts";

function pendingImport(adapter: PublicDataAdapter, now: string, key: string): StoredImport {
  return {
    id: deterministicUuid("ingestion-run", key),
    idempotencyKey: key,
    adapterId: adapter.id,
    sourceId: adapter.sourceId,
    status: "running",
    attemptedAt: now,
    successfulImportAt: null,
    failedAt: null,
    failureCode: null,
    failureMessage: null,
    sourceVersion: null,
    measures: [],
    observations: [],
    recordsRead: 0,
    recordsAccepted: 0,
    recordsRejected: 0,
    observationsPublished: 0,
    cacheDisposition: null,
  };
}

function queryKey(adapter: PublicDataAdapter, geography: Geography, measureIds: string[] = [], contentToken = "attempt") {
  return sha256(JSON.stringify({
    adapterId: adapter.id,
    sourceId: adapter.sourceId,
    releaseKey: adapter.releaseKey(),
    geographyKind: geography.kind,
    geographyAuthority: geography.authority,
    geographyAuthorityId: geography.authorityId,
    geographyVintage: geography.vintage,
    measureIds: [...measureIds].sort(),
    contentToken,
  }));
}

export async function runIngestion({
  adapter,
  query,
  context,
  repository,
}: {
  adapter: PublicDataAdapter;
  query: SourceQuery;
  context: AdapterContext;
  repository: IngestionRepository;
}): Promise<IngestionResult> {
  if (!adapter.supports(query.geography)) {
    throw new Error(`${adapter.id} does not support ${query.geography.kind} geography.`);
  }
  try {
    const batch = await adapter.fetch(query, context);
    const contentToken = batch.sourceVersion?.contentHash ?? `${batch.status}:${batch.statusReason ?? "none"}`;
    const key = queryKey(adapter, query.geography, query.requestedMeasureIds, contentToken);
    const previous = await repository.findImport(key);
    if (previous && ["available", "stale", "unavailable"].includes(previous.status)) {
      return { importRecord: previous, idempotentReplay: true };
    }
    const record = pendingImport(adapter, context.now, key);
    await repository.beginImport(record);
    const completed: StoredImport = {
      ...record,
      successfulImportAt: batch.status === "available" || batch.status === "stale" ? context.now : null,
    };
    await repository.publishBatch(completed, batch);
    const saved = await repository.findImport(key);
    if (!saved) throw new Error("Published ingestion record was not persisted.");
    return { importRecord: saved, idempotentReplay: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion failure.";
    const key = queryKey(adapter, query.geography, query.requestedMeasureIds, `failure:${message}`);
    const previous = await repository.findImport(key);
    if (previous) return { importRecord: previous, idempotentReplay: true };
    const record = pendingImport(adapter, context.now, key);
    await repository.beginImport(record);
    await repository.failImport(key, context.now, "ADAPTER_FAILURE", message);
    const failed = await repository.findImport(key);
    if (!failed) throw error;
    return { importRecord: failed, idempotentReplay: false };
  }
}
