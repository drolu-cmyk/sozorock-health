import type {
  ExploreObservation,
  ExplorePlaceBriefV1,
  ExploreSourceReference,
} from "../explore-contract.ts";

export const STRUCTURED_VISUAL_RESULT_VERSION = "explore.visual-result.v1" as const;

type VisualMeasure = {
  observationId: string;
  label: string;
  value: number | string | boolean | null;
  unit: string;
  universe: string;
  adjustment: string;
  direction: ExploreObservation["direction"];
  interpretation: ExploreObservation["interpretation"];
  confidence: ExploreObservation["confidence"];
  dataPeriod: ExploreObservation["dataPeriod"];
  releaseDate: string;
  source: {
    sourceId: string;
    publisher: string;
    title: string;
    officialUrl: string;
  };
  citations: string[];
};

export type StructuredVisualResult = {
  contractVersion: typeof STRUCTURED_VISUAL_RESULT_VERSION;
  evidenceSnapshotId: string;
  geography: {
    kind: "county";
    authorityId: string;
    displayName: string;
  };
  countyComparison: Array<{
    measure: VisualMeasure;
    benchmark: VisualMeasure | null;
    compatibility: "compatible" | "no_compatible_benchmark";
  }>;
  uncertainty: Array<{
    observationId: string;
    label: string;
    value: number;
    low: number | null;
    high: number | null;
    marginOfError: number | null;
    unit: string;
  }>;
  sourceCoverage: ExplorePlaceBriefV1["publicData"]["sourceCoverage"];
  sourceFreshness: Array<{
    sourceId: string;
    title: string;
    releaseDate: string;
    dataPeriod: { start: string | null; end: string | null };
    retrievedAt: string;
  }>;
  measureExplorer: VisualMeasure[];
  responseFitMatrix: ExplorePlaceBriefV1["evidenceAssessment"]["responseFits"];
  planningSignalMatrix: {
    verifiedLocalPriorities: ExplorePlaceBriefV1["localPlanningEvidence"]["claims"];
    statisticalSignals: VisualMeasure[];
    disclosure: string;
  };
  workforceContext: {
    coverage: ExplorePlaceBriefV1["publicData"]["sourceCoverage"];
    measures: VisualMeasure[];
  };
  limitations: string[];
};

function sourceFor(
  brief: ExplorePlaceBriefV1,
  observation: ExploreObservation,
): ExploreSourceReference | null {
  return brief.publicData.sources.find(
    (source) => source.sourceVersionId === observation.sourceVersionId,
  ) ?? null;
}

function asVisualMeasure(
  brief: ExplorePlaceBriefV1,
  observation: ExploreObservation,
): VisualMeasure | null {
  const source = sourceFor(brief, observation);
  if (!source) return null;
  return {
    observationId: observation.id,
    label: observation.label,
    value: observation.value,
    unit: observation.unit,
    universe: observation.universe,
    adjustment: observation.adjustment,
    direction: observation.direction,
    interpretation: observation.interpretation,
    confidence: observation.confidence,
    dataPeriod: observation.dataPeriod,
    releaseDate: observation.releaseDate,
    source: {
      sourceId: source.sourceId,
      publisher: source.publisher,
      title: source.title,
      officialUrl: source.officialUrl,
    },
    citations: observation.citationIds,
  };
}

function compatibleBenchmark(
  observation: ExploreObservation,
  benchmark: ExploreObservation | undefined,
) {
  return Boolean(
    benchmark
    && benchmark.measureDefinitionId === observation.measureDefinitionId
    && benchmark.unit === observation.unit
    && benchmark.adjustment === observation.adjustment
    && benchmark.dataPeriod.start === observation.dataPeriod.start
    && benchmark.dataPeriod.end === observation.dataPeriod.end,
  );
}

export function buildStructuredVisualResult(
  brief: ExplorePlaceBriefV1,
): StructuredVisualResult {
  const selected = brief.resolution.selected;
  if (!selected || selected.kind !== "county") {
    throw new Error("Structured visual results require one selected county geography.");
  }
  const observations = new Map(
    brief.publicData.observations.map((observation) => [observation.id, observation]),
  );
  const measures = brief.publicData.observations
    .map((observation) => asVisualMeasure(brief, observation))
    .filter((measure): measure is VisualMeasure => Boolean(measure));
  const statisticalSignals = measures.filter((measure) => (
    measure.interpretation === "adverse_signal"
    || measure.interpretation === "favorable_signal"
  ));
  const workforceCoverage = brief.publicData.sourceCoverage.filter((coverage) => (
    coverage.sourceId === "hrsa-workforce" || coverage.sourceId === "ahrf-workforce"
  ));
  const workforceMeasures = measures.filter((measure) => (
    measure.source.sourceId === "hrsa-workforce"
    || measure.source.sourceId === "ahrf-workforce"
  ));

  return {
    contractVersion: STRUCTURED_VISUAL_RESULT_VERSION,
    evidenceSnapshotId: brief.evidenceSnapshotId,
    geography: {
      kind: "county",
      authorityId: selected.authorityId,
      displayName: selected.displayName,
    },
    countyComparison: brief.publicData.observations.map((observation) => {
      const benchmark = observation.benchmarkObservationId
        ? observations.get(observation.benchmarkObservationId)
        : undefined;
      const measure = asVisualMeasure(brief, observation);
      if (!measure) throw new Error(`Observation ${observation.id} lacks an approved source reference.`);
      if (!compatibleBenchmark(observation, benchmark)) {
        return { measure, benchmark: null, compatibility: "no_compatible_benchmark" as const };
      }
      return {
        measure,
        benchmark: asVisualMeasure(brief, benchmark!),
        compatibility: "compatible" as const,
      };
    }),
    uncertainty: brief.publicData.observations.flatMap((observation) => (
      typeof observation.value === "number"
        ? [{
            observationId: observation.id,
            label: observation.label,
            value: observation.value,
            low: observation.confidence.low,
            high: observation.confidence.high,
            marginOfError: observation.confidence.marginOfError,
            unit: observation.unit,
          }]
        : []
    )),
    sourceCoverage: brief.publicData.sourceCoverage,
    sourceFreshness: brief.publicData.sources.map((source) => ({
      sourceId: source.sourceId,
      title: source.title,
      releaseDate: source.releaseDate,
      dataPeriod: source.dataPeriod,
      retrievedAt: source.retrievedAt,
    })),
    measureExplorer: measures,
    responseFitMatrix: brief.evidenceAssessment.responseFits,
    planningSignalMatrix: {
      verifiedLocalPriorities: brief.localPlanningEvidence.claims.filter((claim) => (
        claim.type === "priority" && claim.reviewStatus === "verified"
      )),
      statisticalSignals,
      disclosure: "Verified local planning priorities and statistical signals are separate evidence types. One does not substitute for the other.",
    },
    workforceContext: {
      coverage: workforceCoverage,
      measures: workforceMeasures,
    },
    limitations: [
      ...brief.resolution.caveats,
      ...brief.safety.limitations,
      "No overall county health ranking is calculated.",
      "County observations do not describe ZIP, city, neighborhood, household or individual conditions.",
    ],
  };
}
