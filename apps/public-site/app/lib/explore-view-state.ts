export type ExploreView = "brief" | "map" | "action" | "visuals";
export type ExploreState = { kind: "county" | "place" | "zip"; geoid: string; county?: string; view: ExploreView; measure?: string };

export function readExploreState(params: URLSearchParams): ExploreState | null {
  const kind = params.get("kind");
  const geoid = params.get("geoid") ?? "";
  if (kind !== "county" && kind !== "place" && kind !== "zip") return null;
  if (!(kind === "place" ? /^\d{7}$/ : /^\d{5}$/).test(geoid)) return null;
  const candidate = params.get("view");
  const view: ExploreView = candidate === "map" || candidate === "action" || candidate === "visuals" ? candidate : "brief";
  const county = params.get("county");
  const measure = params.get("measure");
  return { kind, geoid, view, ...(/^\d{5}$/.test(county ?? "") ? { county: county! } : {}),
    ...(/^[a-z0-9_-]{1,50}$/.test(measure ?? "") ? { measure: measure! } : {}) };
}

/** Share only allowlisted public product state; never copy arbitrary query text. */
export function exploreStateUrl(state: ExploreState) {
  const params = new URLSearchParams({ kind: state.kind, geoid: state.geoid, view: state.view });
  if (state.county) params.set("county", state.county);
  if (state.measure) params.set("measure", state.measure);
  return `/explore?${params}`;
}

export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(text) && typeof value !== "number") text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
