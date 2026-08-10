import { createHash } from "node:crypto";

export type SnapshotActivationSource = {
  sourceId: string;
  sourceVersionId: string;
  mappingVersion: string;
};

export function versionedSourceContentHash(input: {
  artifactSha256: string;
  mappingVersion: string;
}) {
  if (!/^[0-9a-f]{64}$/i.test(input.artifactSha256) || !input.mappingVersion.trim()) {
    throw new Error("The versioned source content contract is invalid.");
  }
  return "sha256:" + createHash("sha256")
    .update(input.artifactSha256.toLowerCase() + "|" + input.mappingVersion.trim())
    .digest("hex");
}

export function activatedEvidenceSnapshotContentHash(input: {
  baseSnapshotContentHash: string;
  contractVersion: string;
  policyVersion: string;
  sources: SnapshotActivationSource[];
}) {
  if (!/^sha256:[0-9a-f]{64}$/i.test(input.baseSnapshotContentHash)) {
    throw new Error("The base evidence snapshot content hash is invalid.");
  }
  if (!input.contractVersion || !input.policyVersion || !input.sources.length) {
    throw new Error("The evidence snapshot activation contract is incomplete.");
  }
  const sources = [...input.sources]
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId))
    .map(({ sourceId, sourceVersionId, mappingVersion }) => ({
      sourceId,
      sourceVersionId,
      mappingVersion,
    }));
  const digest = createHash("sha256").update(JSON.stringify({
    baseSnapshotContentHash: input.baseSnapshotContentHash,
    contractVersion: input.contractVersion,
    policyVersion: input.policyVersion,
    sources,
  })).digest("hex");
  return "sha256:" + digest;
}
