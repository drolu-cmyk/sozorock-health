export type PlaceBriefKind = "county";

type NormalizedPlaceBriefKind =
  | { ok: true; kind: PlaceBriefKind; usedLegacyAlias: boolean }
  | { ok: false; code: "missing_type" | "unsupported_type" | "conflicting_type"; message: string };

const supportedKinds = new Set<PlaceBriefKind>(["county"]);

/**
 * Normalize the versioned place-brief geography selector. `kind` is the
 * canonical parameter; `geography` remains a temporary, deprecated alias so
 * existing clients fail safely rather than silently changing scope.
 */
export function normalizePlaceBriefKind(searchParams: URLSearchParams): NormalizedPlaceBriefKind {
  const kindValue = searchParams.get("kind")?.trim().toLowerCase() || null;
  const legacyValue = searchParams.get("geography")?.trim().toLowerCase() || null;

  if (!kindValue && !legacyValue) {
    return {
      ok: false,
      code: "missing_type",
      message: "Provide kind=county with a valid five-digit Census county GEOID.",
    };
  }
  if (kindValue && legacyValue && kindValue !== legacyValue) {
    return {
      ok: false,
      code: "conflicting_type",
      message: "The kind and legacy geography parameters must identify the same geography type.",
    };
  }
  if (kindValue && !supportedKinds.has(kindValue as PlaceBriefKind)) {
    return {
      ok: false,
      code: "unsupported_type",
      message: "The requested place-brief geography type is not supported.",
    };
  }
  if (legacyValue && !supportedKinds.has(legacyValue as PlaceBriefKind)) {
    return {
      ok: false,
      code: "unsupported_type",
      message: "The requested place-brief geography type is not supported.",
    };
  }
  return {
    ok: true,
    kind: (kindValue ?? legacyValue) as PlaceBriefKind,
    usedLegacyAlias: !kindValue && Boolean(legacyValue),
  };
}
