import type {
  CachedFetchResult,
  CachedPayload,
  FetchLike,
  HttpCache,
} from "./types.ts";

function dateMs(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ISO date: ${value}`);
  return parsed;
}

export class InMemoryHttpCache implements HttpCache {
  readonly entries = new Map<string, CachedPayload>();

  async get(key: string) {
    return this.entries.get(key) ?? null;
  }

  async put(key: string, value: CachedPayload) {
    this.entries.set(key, value);
  }
}

export async function fetchWithCache({
  url,
  publicUrl = url,
  cacheKey = url,
  fetcher,
  cache,
  now,
  ttlMs,
  timeoutMs = 30_000,
}: {
  url: string;
  publicUrl?: string;
  cacheKey?: string;
  fetcher: FetchLike;
  cache: HttpCache;
  now: string;
  ttlMs: number;
  timeoutMs?: number;
}): Promise<CachedFetchResult> {
  const cached = await cache.get(cacheKey);
  if (cached && dateMs(cached.expiresAt) >= dateMs(now)) {
    return {
      url: publicUrl,
      body: cached.body,
      contentType: cached.contentType,
      retrievedAt: cached.storedAt,
      disposition: "hit",
      stale: false,
    };
  }

  try {
    const headers: Record<string, string> = { Accept: "application/json,text/csv;q=0.9,*/*;q=0.1" };
    if (cached?.etag) headers["If-None-Match"] = cached.etag;
    if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;
    let response: Awaited<ReturnType<FetchLike>> | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const candidate = await fetcher(url, { headers, signal: controller.signal });
        if ((candidate.status === 429 || candidate.status >= 500) && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
          continue;
        }
        response = candidate;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!response) throw lastError instanceof Error ? lastError : new Error("Official source request failed after three attempts.");
    if (response.status === 304 && cached) {
      const refreshed = {
        ...cached,
        storedAt: now,
        expiresAt: new Date(dateMs(now) + ttlMs).toISOString(),
      };
      await cache.put(cacheKey, refreshed);
      return {
        url: publicUrl,
        body: refreshed.body,
        contentType: refreshed.contentType,
        retrievedAt: now,
        disposition: "revalidated",
        stale: false,
      };
    }
    if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}.`);
    const body = await response.text();
    const payload: CachedPayload = {
      url: publicUrl,
      body,
      contentType: response.headers.get("content-type"),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      storedAt: now,
      expiresAt: new Date(dateMs(now) + ttlMs).toISOString(),
    };
    await cache.put(cacheKey, payload);
    return { url: publicUrl, body, contentType: payload.contentType, retrievedAt: now, disposition: "miss", stale: false };
  } catch (error) {
    if (cached) {
      return {
        url: publicUrl,
        body: cached.body,
        contentType: cached.contentType,
        retrievedAt: cached.storedAt,
        disposition: "stale_fallback",
        stale: true,
      };
    }
    throw error;
  }
}
