import { createHash } from "node:crypto";
import type {
  Geography,
  GeographyRelationship,
  MeasureDefinition,
  MetricObservation,
  ReviewStatus,
  SourceCatalogRecord,
  SourceVersion,
} from "./contracts.ts";

export const SHARED_EVIDENCE_CONTRACT_VERSION = "sozorock.evidence-gateway.v1" as const;

export type GatewayGeographyKind =
  | Geography["kind"]
  | "census_tract"
  | "county_subdivision";

export type MetricSemanticPolicy = {
  trendable: boolean;
  forecastable: boolean;
  aggregatable: boolean;
  allowedGeographyKinds: GatewayGeographyKind[];
  allowedVisualizations: string[];
};

export type GatewayGeography = {
  id: string;
  kind: GatewayGeographyKind;
  authority: Geography["authority"];
  authority_id: string;
  name: string;
  display_name: string;
  state_fips: string | null;
  county_fips: string | null;
  vintage: string;
  valid_from: string | null;
  valid_to: string | null;
  review_status: ReviewStatus;
  caveat: string | null;
};

export type GatewayGeographyRelationship = {
  id: string;
  from_geography_id: string;
  to_geography_id: string;
  kind: GeographyRelationship["kind"];
  source_version_id: string;
  vintage: string;
  overlap_area_percent: number | null;
  overlap_population_percent: number | null;
  method: string;
  caveat: string | null;
  review_status: ReviewStatus;
};

export type GatewaySourceVersion = {
  source_id: string;
  source_version_id: string;
  publisher: string;
  title: string;
  official_url: string;
  release_label: string;
  release_date: string;
  data_period_start: string | null;
  data_period_end: string | null;
  retrieved_at: string;
  stale_after: string | null;
  content_hash: string;
  schema_version: string;
  review_status: ReviewStatus;
};

export type GatewayMetricSemantics = {
  id: string;
  source_measure_id: string;
  name: string;
  description: string;
  direction: MeasureDefinition["direction"];
  higher_value_meaning: MeasureDefinition["higherValueMeaning"];
  unit:
    | MeasureDefinition["unit"]
    | "people"
    | "coverage"
    | "percentile";
  universe: string;
  adjustment: MeasureDefinition["adjustment"];
  comparison_policy: MeasureDefinition["comparisonPolicy"];
  trendable: boolean;
  forecastable: boolean;
  aggregatable: boolean;
  allowed_geography_kinds: GatewayGeographyKind[];
  allowed_visualizations: string[];
  review_status: ReviewStatus;
};

export type GatewayMeasure = {
  id: string;
  semantics: GatewayMetricSemantics;
  geography: GatewayGeography;
  source_version: GatewaySourceVersion;
  geography_level: MetricObservation["geographyLevel"];
  value: number | string | boolean | null;
  numeric_value: number | null;
  confidence_low: number | null;
  confidence_high: number | null;
  margin_of_error: number | null;
  data_period_start: string | null;
  data_period_end: string | null;
  source_metadata: Record<string, string | number | boolean | null>;
  review_status: ReviewStatus;
};

export type PublicEvidencePackageV1 = {
  contract_version: typeof SHARED_EVIDENCE_CONTRACT_VERSION;
  release_id: string;
  generated_at: string;
  geographies: GatewayGeography[];
  geography_relationships: GatewayGeographyRelationship[];
  metric_semantics: GatewayMetricSemantics[];
  measures: GatewayMeasure[];
  source_versions: GatewaySourceVersion[];
};

export type EvidenceGatewayManifestV1 = {
  contract_version: typeof SHARED_EVIDENCE_CONTRACT_VERSION;
  release_id: string;
  generated_at: string;
  evidence_core_schema_version: string;
  release_hash: string;
  source_versions: GatewaySourceVersion[];
};

export type EvidenceGatewayResponseV1 = {
  manifest: EvidenceGatewayManifestV1;
  package: PublicEvidencePackageV1;
};

export type BuildEvidenceGatewayInput = {
  releaseId: string;
  generatedAt: string;
  evidenceCoreSchemaVersion: string;
  geographies: Geography[];
  geographyRelationships?: GeographyRelationship[];
  sourceCatalog: SourceCatalogRecord[];
  sourceVersions: SourceVersion[];
  measureDefinitions: MeasureDefinition[];
  observations: MetricObservation[];
  metricPolicies?: Record<string, MetricSemanticPolicy>;
};

const SAFE_DEFAULT_POLICY: MetricSemanticPolicy = {
  trendable: false,
  forecastable: false,
  aggregatable: false,
  allowedGeographyKinds: [],
  allowedVisualizations: [],
};

function toGatewayGeography(geography: Geography): GatewayGeography {
  return {
    id: geography.id,
    kind: geography.kind,
    authority: geography.authority,
    authority_id: geography.authorityId,
    name: geography.name,
    display_name: geography.displayName,
    state_fips: geography.stateFips,
    county_fips: geography.countyFips,
    vintage: geography.vintage,
    valid_from: geography.validFrom,
    valid_to: geography.validTo,
    review_status: geography.reviewStatus,
    caveat: geography.caveat,
  };
}

function toGatewayRelationship(
  relationship: GeographyRelationship,
): GatewayGeographyRelationship {
  return {
    id: relationship.id,
    from_geography_id: relationship.fromGeographyId,
    to_geography_id: relationship.toGeographyId,
    kind: relationship.kind,
    source_version_id: relationship.sourceVersionId,
    vintage: relationship.vintage,
    overlap_area_percent: relationship.overlapAreaPercent,
    overlap_population_percent: relationship.overlapPopulationPercent,
    method: relationship.method,
    caveat: relationship.caveat,
    review_status: relationship.reviewStatus,
  };
}

function toGatewaySourceVersion(
  sourceVersion: SourceVersion,
  sourceCatalog: SourceCatalogRecord[],
): GatewaySourceVersion {
  const source = sourceCatalog.find((candidate) => candidate.id === sourceVersion.sourceId);
  if (!source) {
    throw new Error(
      `Evidence Gateway cannot serialize source version ${sourceVersion.id}: source catalog record ${sourceVersion.sourceId} is missing`,
    );
  }

  return {
    source_id: sourceVersion.sourceId,
    source_version_id: sourceVersion.id,
    publisher: source.publisher,
    title: source.title,
    official_url: sourceVersion.officialUrl,
    release_label: sourceVersion.releaseLabel,
    release_date: sourceVersion.releaseDate,
    data_period_start: sourceVersion.dataPeriodStart,
    data_period_end: sourceVersion.dataPeriodEnd,
    retrieved_at: sourceVersion.retrievedAt,
    stale_after: sourceVersion.staleAfter,
    content_hash: sourceVersion.contentHash,
    schema_version: sourceVersion.schemaVersion,
    review_status: sourceVersion.reviewStatus,
  };
}

function toGatewayMetricSemantics(
  definition: MeasureDefinition,
  policy: MetricSemanticPolicy | undefined,
): GatewayMetricSemantics {
  const effectivePolicy = policy ?? SAFE_DEFAULT_POLICY;
  return {
    id: definition.id,
    source_measure_id: definition.sourceMeasureId,
    name: definition.name,
    description: definition.description,
    direction: definition.direction,
    higher_value_meaning: definition.higherValueMeaning,
    unit: definition.unit,
    universe: definition.universe,
    adjustment: definition.adjustment,
    comparison_policy: definition.comparisonPolicy,
    trendable: effectivePolicy.trendable,
    forecastable: effectivePolicy.forecastable,
    aggregatable: effectivePolicy.aggregatable,
    allowed_geography_kinds: [...effectivePolicy.allowedGeographyKinds],
    allowed_visualizations: [...effectivePolicy.allowedVisualizations],
    review_status: definition.reviewStatus,
  };
}

export function buildEvidenceGatewayResponseV1(
  input: BuildEvidenceGatewayInput,
): EvidenceGatewayResponseV1 {
  if (!input.releaseId.trim()) throw new Error("Evidence Gateway releaseId is required");
  if (!input.generatedAt.trim()) throw new Error("Evidence Gateway generatedAt is required");
  if (!input.evidenceCoreSchemaVersion.trim()) {
    throw new Error("Evidence Gateway evidenceCoreSchemaVersion is required");
  }

  const geographies = input.geographies.map(toGatewayGeography);
  const geographyById = new Map(geographies.map((item) => [item.id, item]));

  const sourceVersions = input.sourceVersions.map((sourceVersion) =>
    toGatewaySourceVersion(sourceVersion, input.sourceCatalog),
  );
  const sourceVersionById = new Map(sourceVersions.map((item) => [item.source_version_id, item]));

  const metricSemantics = input.measureDefinitions.map((definition) =>
    toGatewayMetricSemantics(definition, input.metricPolicies?.[definition.id]),
  );
  const semanticsById = new Map(metricSemantics.map((item) => [item.id, item]));

  const measures = input.observations.map((observation): GatewayMeasure => {
    const geography = geographyById.get(observation.geographyId);
    if (!geography) {
      throw new Error(
        `Evidence Gateway observation ${observation.id} references missing geography ${observation.geographyId}`,
      );
    }
    const semantics = semanticsById.get(observation.measureDefinitionId);
    if (!semantics) {
      throw new Error(
        `Evidence Gateway observation ${observation.id} references missing measure definition ${observation.measureDefinitionId}`,
      );
    }
    const sourceVersion = sourceVersionById.get(observation.sourceVersionId);
    if (!sourceVersion) {
      throw new Error(
        `Evidence Gateway observation ${observation.id} references missing source version ${observation.sourceVersionId}`,
      );
    }

    return {
      id: observation.id,
      semantics,
      geography,
      source_version: sourceVersion,
      geography_level: observation.geographyLevel,
      value: observation.value,
      numeric_value: observation.numericValue,
      confidence_low: observation.confidenceLow,
      confidence_high: observation.confidenceHigh,
      margin_of_error: observation.marginOfError,
      data_period_start: observation.dataPeriodStart,
      data_period_end: observation.dataPeriodEnd,
      source_metadata: { ...observation.sourceMetadata },
      review_status: observation.reviewStatus,
    };
  });

  const publicPackage: PublicEvidencePackageV1 = {
    contract_version: SHARED_EVIDENCE_CONTRACT_VERSION,
    release_id: input.releaseId,
    generated_at: input.generatedAt,
    geographies,
    geography_relationships: (input.geographyRelationships ?? []).map(toGatewayRelationship),
    metric_semantics: metricSemantics,
    measures,
    source_versions: sourceVersions,
  };

  const releaseHash = `sha256:${createHash("sha256")
    .update(JSON.stringify(publicPackage))
    .digest("hex")}`;

  return {
    manifest: {
      contract_version: SHARED_EVIDENCE_CONTRACT_VERSION,
      release_id: input.releaseId,
      generated_at: input.generatedAt,
      evidence_core_schema_version: input.evidenceCoreSchemaVersion,
      release_hash: releaseHash,
      source_versions: sourceVersions,
    },
    package: publicPackage,
  };
}
