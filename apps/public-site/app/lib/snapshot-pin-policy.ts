export type SnapshotPinCandidate = {
  id: string;
  contentHash: string;
  reviewStatus: "verified" | "provisional" | "stale" | "unavailable" | "rejected";
  publishedAt: string | null;
  sourceVersions: Array<{ sourceId: string; reviewStatus: SnapshotPinCandidate["reviewStatus"] }>;
};

export function selectPinnedSnapshot(candidates: SnapshotPinCandidate[], configuredHash: string) {
  if (!/^sha256:[0-9a-fA-F]{64}$/.test(configuredHash.trim())) return null;
  const selected = candidates.find((candidate) => candidate.contentHash === configuredHash.trim());
  if (!selected || selected.reviewStatus !== "verified" || !selected.publishedAt) return null;
  if (!selected.sourceVersions.length || selected.sourceVersions.some((source) => source.reviewStatus !== "verified")) return null;
  if (!selected.sourceVersions.some((source) => source.sourceId === "cdc-places")) return null;
  return selected;
}
