import {
  extractZipArchiveBounded,
  readBoundedResponseBytes,
  type ZipArchiveLimits,
} from "./bounded-response.ts";
import type { FetchLike } from "./types.ts";

export async function downloadOfficialZip({
  url,
  label,
  fetcher,
  headers,
  timeoutMs,
  maxResponseBytes,
  archiveLimits,
  requiredEntrySuffix,
  maxAttempts = 3,
  retryDelayMs = 500,
}: {
  url: string;
  label: string;
  fetcher: FetchLike;
  headers: Record<string, string>;
  timeoutMs: number;
  maxResponseBytes: number;
  archiveLimits?: ZipArchiveLimits;
  requiredEntrySuffix: string;
  maxAttempts?: number;
  retryDelayMs?: number;
}) {
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer.");
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url, { headers, signal: controller.signal });
      if (!response.ok) throw new Error(`${label} request failed with HTTP ${response.status}.`);
      const bytes = await readBoundedResponseBytes(response, maxResponseBytes);
      const archive = extractZipArchiveBounded(bytes, label, archiveLimits);
      if (!Object.keys(archive).some((name) => name.endsWith(requiredEntrySuffix))) {
        throw new Error(`${label} is missing its required ${requiredEntrySuffix} entry.`);
      }
      return { bytes, archive };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts && retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (2 ** (attempt - 1))));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`${label} could not be downloaded and validated after ${maxAttempts} attempts.`, {
    cause: lastError,
  });
}
