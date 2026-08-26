import type { FetchLikeResponse } from "./types.ts";
import { Unzip, UnzipInflate, UnzipPassThrough } from "fflate";

export type ZipArchiveLimits = {
  maxEntries?: number;
  maxUncompressedBytes?: number;
  maxExpansionRatio?: number;
};

export function extractZipArchiveBounded(
  bytes: Uint8Array,
  label: string,
  limits: ZipArchiveLimits = {},
) {
  let entries = 0;
  let uncompressedBytes = 0;
  const maxEntries = limits.maxEntries ?? 4096;
  const maxUncompressedBytes = limits.maxUncompressedBytes ?? 768 * 1024 * 1024;
  const maxExpansionRatio = limits.maxExpansionRatio ?? 250;
  let failure: Error | null = null;
  const output: Record<string, Uint8Array> = {};
  const unzip = new Unzip((file) => {
    if (failure) return;
    try {
      entries += 1;
      if (entries > maxEntries || Object.hasOwn(output, file.name)) {
        throw new Error(`${label} exceeds approved archive expansion limits.`);
      }
      const chunks: Uint8Array[] = [];
      let entryBytes = 0;
      file.ondata = (error, chunk, final) => {
        if (failure) return;
        if (error) {
          failure = new Error(`${label} could not be safely decompressed.`, { cause: error });
          return;
        }
        entryBytes += chunk.byteLength;
        uncompressedBytes += chunk.byteLength;
        if (
          uncompressedBytes > maxUncompressedBytes
          || uncompressedBytes > Math.max(1, bytes.byteLength) * maxExpansionRatio
        ) {
          failure = new Error(`${label} exceeds approved archive expansion limits.`);
          file.terminate?.();
          return;
        }
        chunks.push(chunk);
        if (final) {
          if (file.originalSize !== undefined && file.originalSize !== entryBytes) {
            failure = new Error(`${label} contains inconsistent archive size metadata.`);
            return;
          }
          const value = new Uint8Array(entryBytes);
          let offset = 0;
          for (const part of chunks) {
            value.set(part, offset);
            offset += part.byteLength;
          }
          output[file.name] = value;
        }
      };
      file.start();
    } catch (error) {
      failure = error instanceof Error ? error : new Error(`${label} could not be safely decompressed.`);
      file.terminate?.();
    }
  });
  unzip.register(UnzipPassThrough);
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.byteLength; offset += 64 * 1024) {
    unzip.push(bytes.subarray(offset, Math.min(bytes.byteLength, offset + 64 * 1024)), offset + 64 * 1024 >= bytes.byteLength);
    if (failure) throw failure;
  }
  if (failure) throw failure;
  return output;
}

export function assertZipArchiveLimits(bytes: Uint8Array, label: string, limits: ZipArchiveLimits = {}) {
  extractZipArchiveBounded(bytes, label, limits);
}

export function assertXlsxStructureLimits(
  entries: Record<string, Uint8Array>,
  label: string,
  limits: { maxRows: number; maxColumns: number; maxCellCharacters: number; maxWorksheetBytes?: number },
) {
  const maxWorksheetBytes = limits.maxWorksheetBytes ?? 64 * 1024 * 1024;
  for (const [name, bytes] of Object.entries(entries)) {
    if (name !== "xl/sharedStrings.xml" && !/^xl\/worksheets\/[^/]+\.xml$/.test(name)) continue;
    if (bytes.byteLength > maxWorksheetBytes) {
      throw new Error(`${label} exceeds the approved worksheet byte limit.`);
    }
    const xml = new TextDecoder().decode(bytes);
    if (name === "xl/sharedStrings.xml") {
      for (const value of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
        if (value[1].length > limits.maxCellCharacters * 8) {
          throw new Error(`${label} exceeds the approved worksheet cell limit.`);
        }
      }
      continue;
    }
    let rowCount = 0;
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      rowCount += 1;
      if (rowCount > limits.maxRows) throw new Error(`${label} exceeds the approved worksheet row limit.`);
      const cells = row[1].match(/<c\b/g)?.length ?? 0;
      if (cells > limits.maxColumns) throw new Error(`${label} exceeds the approved worksheet column limit.`);
      for (const cell of row[1].matchAll(/<(?:t|v)\b[^>]*>([\s\S]*?)<\/(?:t|v)>/g)) {
        if (cell[1].length > limits.maxCellCharacters * 8) {
          throw new Error(`${label} exceeds the approved worksheet cell limit.`);
        }
      }
    }
  }
}

function declaredLength(response: FetchLikeResponse) {
  const raw = response.headers.get("content-length")?.trim();
  if (!raw) return null;
  const length = Number(raw);
  if (!Number.isSafeInteger(length) || length < 0) throw new Error("Official source returned an invalid Content-Length.");
  return length;
}

function assertDeclaredLength(response: FetchLikeResponse, maxBytes: number) {
  const length = declaredLength(response);
  if (length !== null && length > maxBytes) {
    throw new Error(`Official source response exceeds the ${maxBytes}-byte limit.`);
  }
}

export async function readBoundedResponseBytes(response: FetchLikeResponse, maxBytes: number) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("maxBytes must be a positive integer.");
  assertDeclaredLength(response, maxBytes);
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new Error(`Official source response exceeds the ${maxBytes}-byte limit.`);
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    const value = chunk.value ?? new Uint8Array();
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel?.("response size limit exceeded");
      throw new Error(`Official source response exceeds the ${maxBytes}-byte limit.`);
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function readBoundedResponseText(response: FetchLikeResponse, maxBytes: number) {
  if (response.body?.getReader) {
    return new TextDecoder().decode(await readBoundedResponseBytes(response, maxBytes));
  }
  assertDeclaredLength(response, maxBytes);
  const value = await response.text();
  if (Buffer.byteLength(value, "utf8") > maxBytes) {
    throw new Error(`Official source response exceeds the ${maxBytes}-byte limit.`);
  }
  return value;
}
