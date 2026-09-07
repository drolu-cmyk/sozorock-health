import type { FetchLikeResponse } from "./types.ts";
import { unzipSync } from "fflate";
import { crc32 } from "node:zlib";

export type ZipArchiveLimits = {
  maxEntries?: number;
  maxUncompressedBytes?: number;
  maxExpansionRatio?: number;
};

function centralDirectoryRecords(bytes: Uint8Array, label: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let endOffset = -1;
  const earliestEnd = Math.max(0, bytes.byteLength - 65_558);
  for (let offset = bytes.byteLength - 22; offset >= earliestEnd; offset -= 1) {
    if (
      view.getUint32(offset, true) === 0x06054b50
      && offset + 22 + view.getUint16(offset + 20, true) === bytes.byteLength
    ) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error(`${label} could not be safely decompressed.`);

  const entries = view.getUint16(endOffset + 10, true);
  const directorySize = view.getUint32(endOffset + 12, true);
  const directoryOffset = view.getUint32(endOffset + 16, true);
  if (
    entries === 0xffff
    || directorySize === 0xffffffff
    || directoryOffset === 0xffffffff
    || directoryOffset + directorySize > endOffset
  ) {
    throw new Error(`${label} uses unsupported or inconsistent archive metadata.`);
  }

  const records = new Map<string, { crc: number; compressedSize: number; originalSize: number }>();
  let offset = directoryOffset;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > endOffset || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error(`${label} contains inconsistent archive metadata.`);
    }
    const flags = view.getUint16(offset + 8, true);
    const crc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const originalSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > endOffset || localOffset + 30 > directoryOffset) {
      throw new Error(`${label} contains inconsistent archive metadata.`);
    }
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (records.has(name)) throw new Error(`${label} exceeds approved archive expansion limits.`);
    if ((flags & 0x08) === 0) {
      if (
        view.getUint32(localOffset, true) !== 0x04034b50
        || view.getUint32(localOffset + 18, true) !== compressedSize
        || view.getUint32(localOffset + 22, true) !== originalSize
      ) {
        throw new Error(`${label} contains inconsistent archive size metadata.`);
      }
    }
    records.set(name, { crc, compressedSize, originalSize });
    offset = nextOffset;
  }
  if (offset !== directoryOffset + directorySize) {
    throw new Error(`${label} contains inconsistent archive metadata.`);
  }
  return records;
}

export function extractZipArchiveBounded(
  bytes: Uint8Array,
  label: string,
  limits: ZipArchiveLimits = {},
) {
  const maxEntries = limits.maxEntries ?? 4096;
  const maxUncompressedBytes = limits.maxUncompressedBytes ?? 768 * 1024 * 1024;
  const maxExpansionRatio = limits.maxExpansionRatio ?? 250;
  const records = centralDirectoryRecords(bytes, label);
  const uncompressedBytes = [...records.values()]
    .reduce((total, record) => total + record.originalSize, 0);
  if (
    records.size > maxEntries
    || uncompressedBytes > maxUncompressedBytes
    || uncompressedBytes > Math.max(1, bytes.byteLength) * maxExpansionRatio
  ) {
    throw new Error(`${label} exceeds approved archive expansion limits.`);
  }
  let output: Record<string, Uint8Array>;
  try {
    output = unzipSync(bytes);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(label)) throw error;
    throw new Error(`${label} could not be safely decompressed.`, { cause: error });
  }
  for (const [name, value] of Object.entries(output)) {
    const record = records.get(name);
    if (
      !record
      || record.originalSize !== value.byteLength
      || (crc32(value) >>> 0) !== record.crc
    ) {
      throw new Error(`${label} contains inconsistent archive size metadata.`);
    }
  }
  if (Object.keys(output).length !== records.size) {
    throw new Error(`${label} contains inconsistent archive metadata.`);
  }
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
  const contentEncoding = response.headers.get("content-encoding")?.trim().toLowerCase();
  const expectedBytes = contentEncoding && contentEncoding !== "identity"
    ? null
    : declaredLength(response);
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new Error(`Official source response exceeds the ${maxBytes}-byte limit.`);
    if (expectedBytes !== null && bytes.byteLength !== expectedBytes) {
      throw new Error("Official source response was truncated or has inconsistent length metadata.");
    }
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
  if (expectedBytes !== null && output.byteLength !== expectedBytes) {
    throw new Error("Official source response was truncated or has inconsistent length metadata.");
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
