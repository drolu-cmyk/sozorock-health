/** English pages that have a Spanish edition under /es. */
export const SPANISH_PAGES = ["/", "/primary-care-access", "/privacy", "/terms", "/accessibility", "/nondiscrimination"] as const;

export function spanishPath(path: string): string {
  return path === "/" ? "/es" : `/es${path}`;
}

/** The same page in the other language, or that language's homepage when no edition exists. */
export function counterpartPath(path: string, spanish: boolean): string {
  if (spanish) return path.replace(/^\/es(?=\/|$)/, "") || "/";
  return (SPANISH_PAGES as readonly string[]).includes(path) ? spanishPath(path) : "/es";
}
