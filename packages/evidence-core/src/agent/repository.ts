import type { PlaceAgentRepository, PlaceEvidenceSnapshot } from "./types.ts";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryPlaceAgentRepository implements PlaceAgentRepository {
  readonly #snapshot: PlaceEvidenceSnapshot;

  constructor(snapshot: PlaceEvidenceSnapshot) {
    this.#snapshot = clone(snapshot);
  }

  getSnapshotId() {
    return this.#snapshot.snapshotId;
  }

  getCatalog() {
    return clone(this.#snapshot.geographyCatalog);
  }

  getGeography(id: string) {
    return clone(this.#snapshot.geographyCatalog.geographies.find((item) => item.id === id) ?? null);
  }

  getGeographySourceVersionId(id: string) {
    return this.#snapshot.geographySourceVersionByGeographyId[id] ?? null;
  }

  getSourceCatalog(id: string) {
    return clone(this.#snapshot.sourceCatalog.find((item) => item.id === id) ?? null);
  }

  getSourceVersion(id: string) {
    return clone(this.#snapshot.sourceVersions.find((item) => item.id === id) ?? null);
  }

  getMeasureDefinition(id: string) {
    return clone(this.#snapshot.measureDefinitions.find((item) => item.id === id) ?? null);
  }

  listObservations(geographyId: string) {
    return clone(this.#snapshot.observations.filter((item) => item.geographyId === geographyId));
  }

  listPlanningDocuments(geographyId: string) {
    return clone(this.#snapshot.planningDocuments.filter((item) => item.geographyIds.includes(geographyId)));
  }

  listClaims(documentIds: string[]) {
    const allowed = new Set(documentIds);
    return clone(this.#snapshot.claims.filter((item) => allowed.has(item.documentId)));
  }

  listCitations(claimIds: string[]) {
    const allowed = new Set(claimIds);
    return clone(this.#snapshot.citations.filter((item) => allowed.has(item.claimId)));
  }
}
