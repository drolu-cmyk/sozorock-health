type LinkedSource = { id: string; sourceId: string; releaseDate: string; retrievedAt: string };
const contextSources = new Set(["census-acs5", "hrsa-workforce", "ahrf-workforce", "ahrq-clh"]);

/** Called only after every linked source has passed the snapshot review gate. */
export function currentContextSources<T extends LinkedSource>(linked: T[]): T[] {
  const current = new Map<string, string>();
  for (const source of [...linked].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)
    || b.retrievedAt.localeCompare(a.retrievedAt) || a.id.localeCompare(b.id))) {
    if (contextSources.has(source.sourceId) && !current.has(source.sourceId)) current.set(source.sourceId, source.id);
  }
  return linked.filter(source => !contextSources.has(source.sourceId) || source.id === current.get(source.sourceId));
}
