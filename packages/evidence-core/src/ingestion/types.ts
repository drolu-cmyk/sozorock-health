import type {
  Geography,
  MeasureDefinition,
  MetricObservation,
  SourceImportStatus,
  SourceVersion,
} from "../contracts.ts";

export type CacheDisposition = "miss" | "hit" | "revalidated" | "stale_fallback";

export type FetchLikeResponse = {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<FetchLikeResponse>;

export type SourceQuery = {
  geography: Geography;
  requestedMeasureIds?: string[];
};

export type AdapterBatch = {
  adapterId: string;
  sourceId: string;
  status: Exclude<SourceImportStatus, "running" | "failed">;
  statusReason: string | null;
  sourceVersion: SourceVersion | null;
  measures: MeasureDefinition[];
  observations: MetricObservation[];
  recordsRead: number;
  recordsAccepted: number;
  recordsRejected: number;
  warnings: string[];
  cacheDisposition: CacheDisposition;
};

export type AdapterContext = {
  fetcher: FetchLike;
  now: string;
  cache: HttpCache;
};

export type PublicDataAdapter = {
  id: string;
  sourceId: string;
  releaseKey(): string;
  supports(geography: Geography): boolean;
  fetch(query: SourceQuery, context: AdapterContext): Promise<AdapterBatch>;
};

export type CachedPayload = {
  url: string;
  body: string;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  storedAt: string;
  expiresAt: string;
};

export type CachedFetchResult = {
  url: string;
  body: string;
  contentType: string | null;
  retrievedAt: string;
  disposition: CacheDisposition;
  stale: boolean;
};

export type HttpCache = {
  get(key: string): Promise<CachedPayload | null>;
  put(key: string, value: CachedPayload): Promise<void>;
};

export type IngestionRepository = {
  findImport(idempotencyKey: string): Promise<StoredImport | null>;
  beginImport(record: StoredImport): Promise<void>;
  publishBatch(record: StoredImport, batch: AdapterBatch): Promise<void>;
  failImport(idempotencyKey: string, failedAt: string, code: string, message: string): Promise<void>;
};

export type StoredImport = {
  id: string;
  idempotencyKey: string;
  adapterId: string;
  sourceId: string;
  status: SourceImportStatus;
  attemptedAt: string;
  successfulImportAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  sourceVersion: SourceVersion | null;
  measures: MeasureDefinition[];
  observations: MetricObservation[];
  recordsRead: number;
  recordsAccepted: number;
  recordsRejected: number;
  observationsPublished: number;
  cacheDisposition: CacheDisposition | null;
};

export type IngestionResult = {
  importRecord: StoredImport;
  idempotentReplay: boolean;
};
