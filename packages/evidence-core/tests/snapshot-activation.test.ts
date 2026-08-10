import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  activatedEvidenceSnapshotContentHash,
  versionedSourceContentHash,
} from "../src/ingestion/snapshot-activation.ts";

const base = {
  baseSnapshotContentHash: "sha256:" + "a".repeat(64),
  contractVersion: "explore.place-brief.v1",
  policyVersion: "place-evidence-policy.v1",
  sources: [
    { sourceId: "census-acs5", sourceVersionId: "acs-v2", mappingVersion: "acs5.provenance.v2" },
    { sourceId: "hrsa-workforce", sourceVersionId: "hrsa-v1", mappingVersion: "hrsa.context.v1" },
  ],
};

test("activated snapshot hashes are deterministic across source ordering", () => {
  const first = activatedEvidenceSnapshotContentHash(base);
  const second = activatedEvidenceSnapshotContentHash({ ...base, sources: [...base.sources].reverse() });
  assert.equal(first, second);
  assert.match(first, /^sha256:[0-9a-f]{64}$/);
});

test("an ACS provenance contract change creates a new immutable snapshot identity", () => {
  const current = activatedEvidenceSnapshotContentHash(base);
  const corrected = activatedEvidenceSnapshotContentHash({
    ...base,
    sources: base.sources.map((source) => source.sourceId === "census-acs5"
      ? { ...source, sourceVersionId: "acs-v3", mappingVersion: "acs5.provenance.v3" }
      : source),
  });
  assert.notEqual(corrected, current);
});

test("a mapping contract creates a distinct immutable source-version content hash", () => {
  const artifactSha256 = "b".repeat(64);
  const first = versionedSourceContentHash({ artifactSha256, mappingVersion: "acs5.provenance.v1" });
  const corrected = versionedSourceContentHash({ artifactSha256, mappingVersion: "acs5.provenance.v2" });
  assert.notEqual(first, corrected);
  assert.match(first, /^sha256:[0-9a-f]{64}$/);
  assert.throws(() => versionedSourceContentHash({ artifactSha256: "not-a-hash", mappingVersion: "v1" }));
});

test("invalid activation inputs fail closed", () => {
  assert.throws(() => activatedEvidenceSnapshotContentHash({ ...base, baseSnapshotContentHash: "snapshot:demo" }));
  assert.throws(() => activatedEvidenceSnapshotContentHash({ ...base, sources: [] }));
});

test("a published snapshot, source links, and county coverage activate atomically", async () => {
  const loader = await readFile(
    new URL("../scripts/load-national-context-data-api.ts", import.meta.url),
    "utf8",
  );
  const begin = loader.indexOf("new BeginTransactionCommand(base)");
  const snapshot = loader.indexOf("INSERT INTO evidence.evidence_snapshot", begin);
  const coverage = loader.indexOf("await chunks(coverage", snapshot);
  const commit = loader.indexOf("new CommitTransactionCommand", coverage);
  const rollback = loader.indexOf("new RollbackTransactionCommand", commit);
  const output = loader.indexOf("writeFile(activationOutputPath", rollback);
  assert.ok(begin >= 0 && begin < snapshot && snapshot < coverage && coverage < commit);
  assert.ok(commit < rollback && rollback < output);
  assert.match(loader.slice(begin, commit), /opened\.transactionId/);
});
