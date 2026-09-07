import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { downloadOfficialZip } from "../src/ingestion/official-zip.ts";
import type { FetchLike } from "../src/ingestion/types.ts";

function zipResponse(bytes: Uint8Array): Awaited<ReturnType<FetchLike>> {
  return {
    status: 200,
    ok: true,
    headers: { get: (name) => name.toLowerCase() === "content-length" ? String(bytes.byteLength) : null },
    async text() { return ""; },
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
  };
}

test("official ZIP download retries a truncated archive before returning data", async () => {
  const valid = zipSync({ "approved.csv": strToU8("county,value\n36001,1\n") });
  const truncated = valid.subarray(0, 10);
  let attempts = 0;
  const fetcher: FetchLike = async () => {
    attempts += 1;
    return zipResponse(attempts === 1 ? truncated : valid);
  };

  const artifact = await downloadOfficialZip({
    url: "https://example.test/approved.zip",
    label: "Approved fixture archive",
    fetcher,
    headers: {},
    timeoutMs: 1_000,
    maxResponseBytes: 10_000,
    requiredEntrySuffix: "approved.csv",
    maxAttempts: 3,
    retryDelayMs: 0,
  });

  assert.equal(attempts, 2);
  assert.equal(new TextDecoder().decode(artifact.archive["approved.csv"]), "county,value\n36001,1\n");
});
