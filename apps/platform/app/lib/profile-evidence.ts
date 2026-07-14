import type { ProfileResponse } from "./types";

export type ProfileProvenance = ProfileResponse["provenance"];

export function profileEvidenceLabel(provenance: ProfileProvenance | null | undefined) {
  if (!provenance) {
    return "Nationwide public evidence view";
  }
  if (provenance?.evidenceStatus === "derived-official-source-estimates") {
    return "State summary derived from county CDC estimates";
  }
  if (provenance?.evidenceStatus === "official-source-estimates") {
    return "Published CDC model-based estimates";
  }
  return "Official geography · compatible health measures unavailable";
}

export function profileEstimateLabel(provenance: ProfileProvenance | null | undefined) {
  return provenance?.evidenceStatus === "derived-official-source-estimates"
    ? "Derived state summary"
    : "Published model-based estimate";
}

export function profileEvidenceMethod(provenance: ProfileProvenance | null | undefined) {
  return provenance?.indicators?.method
    ?? provenance?.geography.method
    ?? "Select a geography to see its evidence method.";
}
