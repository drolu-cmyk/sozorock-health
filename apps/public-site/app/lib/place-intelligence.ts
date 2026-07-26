import type { ExploreKind } from "./explore-health";

export type EvidenceStatus =
  | "Supported"
  | "Potentially supported"
  | "Insufficient evidence";

export type PlaceIntelligenceMetric = {
  key: string;
  label: string;
  category: "Chronic conditions" | "Access barriers" | "Prevention";
  plainLanguage: string;
  response: string;
  value: number;
  national: number;
  state: number | null;
  difference: number;
  score: number;
  release: "2025" | "2024";
  higherValueMeaning: "adverse" | "favorable" | "context_dependent";
  interpretation: "adverse_signal" | "favorable_signal" | "context_only" | "equal";
};

type LocalPlan = null | {
  title: string;
  period: string;
  published: string;
  url: string;
  findings: string[];
};

type PlaceIntelligenceInput = {
  location: {
    kind: ExploreKind;
    geoid: string;
    label: string;
    state: string;
    population: number;
  };
  metrics: PlaceIntelligenceMetric[];
  priorities: PlaceIntelligenceMetric[];
  localPlan: LocalPlan;
};

export type PlaceIntelligence = {
  generatedAt: string;
  evidenceBasis: string;
  locationSummary: string;
  keyFindings: Array<{
    title: string;
    statement: string;
    source: string;
    status: EvidenceStatus;
  }>;
  healthAccessDay: {
    status: EvidenceStatus;
    statement: string;
    reasons: string[];
  };
  priorityIssues: Array<{
    key: string;
    title: string;
    category: PlaceIntelligenceMetric["category"];
    localValue: number;
    benchmarkValue: number;
    difference: number;
    source: string;
    status: EvidenceStatus;
  }>;
  practicalBarriers: Array<{
    title: string;
    statement: string;
    status: EvidenceStatus;
    source: string;
  }>;
  placeBasedResponses: Array<{
    name: string;
    status: EvidenceStatus;
    reason: string;
    evidence: string;
  }>;
  geospatialInsights: Array<{
    title: string;
    statement: string;
    layer: string;
    status: EvidenceStatus;
  }>;
  questions: Array<{
    id: string;
    prompt: string;
    answer: string;
  }>;
  limitations: string[];
};

const number = new Intl.NumberFormat("en-US");

function statusForDifference(difference: number): EvidenceStatus {
  if (difference >= 5) return "Supported";
  if (difference >= 2) return "Potentially supported";
  return "Insufficient evidence";
}

function compare(metric: PlaceIntelligenceMetric) {
  const direction = metric.difference >= 0 ? "above" : "below";
  return `${metric.value.toFixed(1)}%, ${Math.abs(metric.difference).toFixed(1)} percentage points ${direction} the national geographic average`;
}

function sourceLabel(metric: PlaceIntelligenceMetric) {
  return `CDC PLACES ${metric.release} release`;
}

function geographyLabel(kind: ExploreKind) {
  if (kind === "zip") return "ZIP Code area";
  if (kind === "place") return "city or place";
  return "county";
}

export function buildPlaceIntelligence({
  location,
  metrics,
  priorities,
  localPlan,
}: PlaceIntelligenceInput): PlaceIntelligence {
  const strongest = priorities[0] ?? metrics[0];
  const strongSignals = metrics.filter((metric) => {
    const adverse = metric.interpretation
      ? metric.interpretation === "adverse_signal"
      : metric.difference >= 5;
    return adverse && metric.difference >= 5;
  });
  const accessSignals = metrics
    .filter((metric) => metric.category === "Access barriers")
    .sort((a, b) => b.difference - a.difference);
  const supportedAccessSignals = accessSignals.filter((metric) =>
    metric.interpretation
      ? metric.interpretation === "adverse_signal"
      : metric.difference >= 2,
  );
  const preventionSignals = metrics
    .filter((metric) => metric.category === "Prevention")
    .sort((a, b) => b.score - a.score);

  const healthAccessDayStatus: EvidenceStatus =
    (strongSignals.length >= 2 && supportedAccessSignals.length >= 1) ||
    (Boolean(localPlan) && strongSignals.length >= 1)
      ? "Supported"
      : strongSignals.length >= 1
        ? "Potentially supported"
        : "Insufficient evidence";

  const healthAccessDayStatement =
    healthAccessDayStatus === "Supported"
      ? `The current evidence supports considering a Health Access Day in ${location.label}, subject to local confirmation and licensed-professional participation.`
      : healthAccessDayStatus === "Potentially supported"
        ? `The current evidence supports further local review of a Health Access Day in ${location.label}; more current local planning context would strengthen the decision.`
        : `The measures currently available do not establish a strong enough case for a Health Access Day in ${location.label}.`;

  const keyFindings = priorities.slice(0, 5).map((metric) => ({
    title: metric.label,
    statement: `${metric.label} is estimated at ${compare(metric)}.`,
    source: sourceLabel(metric),
    status: statusForDifference(metric.difference),
  }));

  const practicalBarriers = accessSignals.length
    ? accessSignals.slice(0, 4).map((metric) => ({
        title: metric.label,
        statement:
          metric.difference >= 2
            ? `${metric.label} is a locally elevated practical barrier at ${compare(metric)}.`
            : `${metric.label} is available for this place, but the estimate is not materially above the national geographic average.`,
        status: statusForDifference(metric.difference),
        source: sourceLabel(metric),
      }))
    : [
        {
          title: "Practical barrier coverage",
          statement:
            "No compatible place-level practical-barrier measure is available in the current release for this selection.",
          status: "Insufficient evidence" as const,
          source: "Current source coverage",
        },
      ];

  const hubSignal = supportedAccessSignals[0];
  const providerSignal = metrics.find((metric) =>
    ["access2", "lacktrpt", "mobility", "disability"].includes(metric.key),
  );
  const preventionSignal = preventionSignals[0];

  const placeBasedResponses = [
    {
      name: "Health Access Day",
      status: healthAccessDayStatus,
      reason: healthAccessDayStatement,
      evidence: strongSignals.length
        ? strongSignals
            .slice(0, 3)
            .map((metric) => `${metric.label}: ${compare(metric)}`)
            .join("; ")
        : "No measure is at least five percentage points above its national geographic average.",
    },
    {
      name: "Health Equity Hub formats",
      status: hubSignal ? ("Supported" as const) : ("Insufficient evidence" as const),
      reason: hubSignal
        ? `${hubSignal.label} supports evaluating library, community or home-based formats that bring practical support closer to residents.`
        : "A location-specific practical-barrier signal is needed before selecting a hub format.",
      evidence: hubSignal
        ? `${hubSignal.label}: ${compare(hubSignal)}`
        : "No locally elevated access-barrier estimate is available in this view.",
    },
    {
      name: "Provider-led pathways",
      status: providerSignal
        ? statusForDifference(providerSignal.difference)
        : ("Insufficient evidence" as const),
      reason: providerSignal
        ? `${providerSignal.label} can inform how residents prepare to use existing licensed services while providers retain their platforms, records and clinical responsibility.`
        : "The current source set does not provide a compatible provider-readiness measure for this place.",
      evidence: providerSignal
        ? `${providerSignal.label}: ${compare(providerSignal)}`
        : "No compatible provider-readiness measure.",
    },
    {
      name: "CHA/CHIP planning support",
      status: localPlan
        ? ("Supported" as const)
        : ("Potentially supported" as const),
      reason: localPlan
        ? `The current public plan is included alongside the place measures so planners can test whether the signals align with stated local priorities.`
        : "The place measures can help frame planning questions, but a current local CHA/CHIP source has not been added for this geography.",
      evidence: localPlan
        ? `${localPlan.title}, published ${localPlan.published}`
        : "CDC PLACES measures only; local plan context not available.",
    },
    {
      name: "Workforce capacity",
      status: "Insufficient evidence" as const,
      reason:
        "Workforce action requires a location-specific shortage designation or comparable workforce measure before a recommendation is made.",
      evidence:
        "HRSA is listed as an approved source, but no location-specific workforce value is displayed in this view.",
    },
  ];

  const healthAccessDayReasonMetrics = [
    ...strongSignals.slice(0, 2),
    ...supportedAccessSignals.slice(0, 1),
  ].filter(
    (metric, index, all) => all.findIndex((item) => item.key === metric.key) === index,
  );
  const healthAccessDayReasons = [
    ...healthAccessDayReasonMetrics.map((metric) => `${metric.label}: ${compare(metric)}.`),
    ...(localPlan
      ? [`Current local planning context: ${localPlan.title}.`]
      : ["A current local CHA/CHIP source is not yet included for this geography."]),
  ].slice(0, 4);

  const limitations = [
    "CDC PLACES values are modeled area estimates, not diagnoses or counts of individual people.",
    "A comparison identifies a signal; it does not establish a local priority without community and institutional review.",
    localPlan
      ? `Local plan context is limited to ${localPlan.title}.`
      : "A current local CHA/CHIP source is not yet included for this geography.",
    "No individual medical information is used or displayed.",
  ];

  const locationSummary = `${location.label} is a U.S. ${geographyLabel(location.kind)}${
    location.population > 0
      ? ` with an estimated population of ${number.format(location.population)}`
      : ""
  }. ${strongest ? `${strongest.label} is the strongest signal among the measures currently available.` : "The current source set has limited compatible measures for this place."}`;

  const strongestAnswer = strongest
    ? `${strongest.label} is the strongest current signal at ${compare(strongest)}. It comes from the ${sourceLabel(strongest)}.`
    : "The current source set does not provide enough compatible measures to identify a strongest signal.";
  const barrierAnswer = supportedAccessSignals.length
    ? supportedAccessSignals
        .slice(0, 3)
        .map((metric) => `${metric.label} is ${compare(metric)}.`)
        .join(" ")
    : "No practical-barrier measure in this view is at least two percentage points above its national geographic average.";

  return {
    generatedAt: new Date().toISOString(),
    evidenceBasis: localPlan
      ? "Current public measures plus an available local CHA/CHIP source"
      : "Current public measures; local CHA/CHIP source not yet available",
    locationSummary,
    keyFindings,
    healthAccessDay: {
      status: healthAccessDayStatus,
      statement: healthAccessDayStatement,
      reasons: healthAccessDayReasons,
    },
    priorityIssues: priorities.slice(0, 5).map((metric) => ({
      key: metric.key,
      title: metric.label,
      category: metric.category,
      localValue: metric.value,
      benchmarkValue: metric.national,
      difference: metric.difference,
      source: sourceLabel(metric),
      status: statusForDifference(metric.difference),
    })),
    practicalBarriers,
    placeBasedResponses,
    geospatialInsights: [
      {
        title: "Selected-place boundary",
        statement: `The map shows the official boundary returned for ${location.label}.`,
        layer: "U.S. Census Bureau boundary",
        status: "Supported",
      },
      {
        title: "Major-road context",
        statement:
          "Roads provide orientation for delivery planning; they do not measure travel time or transportation access on their own.",
        layer: "U.S. Census Bureau transportation network",
        status: "Supported",
      },
      {
        title: strongest ? strongest.label : "Selected measure",
        statement: strongest
          ? `Use ${strongest.label.toLowerCase()} as the active evidence layer for this place; the current estimate is ${compare(strongest)}.`
          : "No compatible measure is available for an evidence layer.",
        layer: strongest ? `${sourceLabel(strongest)} measure` : "No measure available",
        status: strongest
          ? statusForDifference(strongest.difference)
          : "Insufficient evidence",
      },
    ],
    questions: [
      {
        id: "strongest-signal",
        prompt: "What is the strongest signal here?",
        answer: strongestAnswer,
      },
      {
        id: "health-access-day",
        prompt: "Does the evidence support a Health Access Day?",
        answer: `${healthAccessDayStatement} ${healthAccessDayReasons.join(" ")}`,
      },
      {
        id: "practical-barriers",
        prompt: "Which practical barriers stand out?",
        answer: barrierAnswer,
      },
      {
        id: "missing-evidence",
        prompt: "What evidence is still missing?",
        answer: localPlan
          ? "The view still needs location-specific workforce, service-capacity and community-input evidence before implementation decisions are made."
          : "The view still needs a current local CHA/CHIP source, location-specific workforce and service-capacity evidence, and community input before implementation decisions are made.",
      },
      {
        id: "prevention-opportunity",
        prompt: "What prevention opportunity is visible?",
        answer: preventionSignal
          ? `${preventionSignal.label} is estimated at ${compare(preventionSignal)}. Use the source definition and local context before setting an education or prevention priority.`
          : "No compatible prevention measure is available in this view.",
      },
    ],
    limitations,
  };
}
