import registryData from "../../data/evidence-registry.json";
import sourceManifestData from "../../data/source-manifest.json";
import type {
  BarrierTaxonomyRecord,
  DerivedInsightTrace,
  EvidenceRegistry,
  EvidenceSourceRecord,
  SourceManifest,
} from "./types";

export const evidenceRegistry = registryData as EvidenceRegistry;
const sourceManifest = sourceManifestData as SourceManifest;

const officialHostSuffixes = [
  ".census.gov",
  ".cdc.gov",
  ".hrsa.gov",
  ".fcc.gov",
  ".usda.gov",
  ".usgs.gov",
];

function isOfficialPublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && officialHostSuffixes.some((suffix) => (
        url.hostname === suffix.slice(1) || url.hostname.endsWith(suffix)
      ));
  } catch {
    return false;
  }
}

export function validateEvidenceRegistry(
  registry: EvidenceRegistry = evidenceRegistry,
) {
  const errors: string[] = [];
  const sourceIds = new Set<string>();

  if (!/^\d{4}-\d{2}-\d{2}-v\d+$/.test(registry.version)) {
    errors.push("Registry version must be a dated version identifier.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(registry.verifiedAt)) {
    errors.push("Registry verifiedAt must be an ISO date.");
  }
  if (registry.geographySearch.statesAndDistrictOfColumbia.count !== 51) {
    errors.push("Nationwide search must include 50 states and the District of Columbia.");
  }
  if (registry.geographySearch.countyEquivalents.count !== sourceManifest.quality.actualCountyEquivalents) {
    errors.push("Registry county coverage must match the committed source manifest.");
  }

  for (const source of registry.sources) {
    if (sourceIds.has(source.id)) errors.push(`Duplicate source id: ${source.id}`);
    sourceIds.add(source.id);
    if (!isOfficialPublicUrl(source.officialUrl)) {
      errors.push(`Source ${source.id} must use an official public .gov URL.`);
    }
    if (source.integrationStatus === "planned-ingestion"
      && source.coverage.status !== "planned-not-displayed") {
      errors.push(`Planned source ${source.id} must remain explicitly not displayed.`);
    }
    if (source.coverage.numerator !== null && source.coverage.denominator !== null
      && source.coverage.numerator > source.coverage.denominator) {
      errors.push(`Source ${source.id} has invalid coverage counts.`);
    }
  }

  const references = [
    registry.chaChipSupport.sourceId,
    ...registry.barrierTaxonomy.flatMap((item) => item.sourceIds),
    ...registry.workforceReadiness.dimensions.flatMap((item) => item.sourceIds),
  ];
  for (const id of new Set(references)) {
    if (!sourceIds.has(id)) errors.push(`Unknown source reference: ${id}`);
  }

  const disability = registry.barrierTaxonomy.find((item) => item.id === "accessibility");
  if (!disability || disability.classification !== "accessibility-context"
    || disability.measureKeys.some((key) => key !== "disability")) {
    errors.push("Disability must remain accessibility context, not a pathway barrier.");
  }
  for (const item of registry.barrierTaxonomy) {
    if (item.evidenceStatus === "planned-not-displayed" && item.measureKeys.length) {
      errors.push(`Planned taxonomy item ${item.id} must not claim displayed measures.`);
    }
  }

  const countySource = registry.sources.find((source) => source.id === "cdc-places-county-2025");
  if (!countySource
    || countySource.coverage.numerator !== sourceManifest.indicators.matchedCountyCount
    || countySource.coverage.denominator !== sourceManifest.quality.actualCountyEquivalents
    || countySource.freshness.snapshotGeneratedAt !== sourceManifest.generatedAt) {
    errors.push("CDC county registry lineage must match the committed source manifest.");
  }

  if (registry.systemsIntelligence.traceability.sequence.join(" -> ") !== "Evidence -> Interpretation -> Lever") {
    errors.push("Systems intelligence must preserve Evidence -> Interpretation -> Lever traceability.");
  }
  if (registry.systemsIntelligence.maturityModel.currentPublicRelease !== "Structured Integration") {
    errors.push("The public release maturity statement must remain at Structured Integration.");
  }

  return errors;
}

export function validateDerivedInsightTrace(trace: DerivedInsightTrace) {
  const errors: string[] = [];
  const knownSources = new Set(evidenceRegistry.sources.map((source) => source.id));
  if (!trace.id.trim()) errors.push("A derived insight needs an identifier.");
  if (!trace.sourceIds.length) errors.push("A derived insight needs at least one source.");
  for (const sourceId of trace.sourceIds) {
    if (!knownSources.has(sourceId)) errors.push(`Unknown source reference: ${sourceId}`);
  }
  if (!trace.method.trim()) errors.push("A derived insight needs a visible method.");
  if (!trace.limitations.length || trace.limitations.some((item) => !item.trim())) {
    errors.push("A derived insight needs explicit limitations.");
  }
  if (!trace.humanReview.trim()) errors.push("A derived insight needs a human-review rule.");
  return errors;
}

export function evidenceSourceById(id: string): EvidenceSourceRecord | null {
  return evidenceRegistry.sources.find((source) => source.id === id) ?? null;
}

export function displayedBarrierTaxonomy(): BarrierTaxonomyRecord[] {
  return evidenceRegistry.barrierTaxonomy.filter((item) => item.evidenceStatus === "displayed");
}

export function plannedEvidenceSources(): EvidenceSourceRecord[] {
  return evidenceRegistry.sources.filter((source) => source.integrationStatus === "planned-ingestion");
}
