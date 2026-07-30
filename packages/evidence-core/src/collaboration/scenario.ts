import type { ScenarioInputs, ScenarioOutput, ScenarioReviewStatus } from "./types.ts";

export const SCENARIO_CONTRACT_VERSION = "explore.scenario.v1" as const;
export const SCENARIO_MODEL_VERSION = "place-planning-range.v1" as const;
export const REACH_NOT_CALCULATED = "Reach not calculated—local capacity and delivery assumptions are required." as const;

export type BuildScenarioInput = {
  inputs: ScenarioInputs;
  evidenceUsed: string[];
  evidenceMissing: string[];
  assumptionOwner: string;
  createdAt: string;
  humanReviewStatus?: ScenarioReviewStatus;
};

function positive(value: number | null) {
  return value !== null && Number.isFinite(value) && value > 0;
}

export function buildPlanningScenario(input: BuildScenarioInput): ScenarioOutput {
  const capacity = input.inputs.verifiedPartnerCapacity;
  const events = input.inputs.eventFrequencyPerYear;
  const workforce = input.inputs.workforceAvailability;
  const missing = new Set(input.evidenceMissing);

  if (!positive(capacity)) missing.add("Verified partner capacity");
  if (!positive(events)) missing.add("Event frequency");
  if (!positive(workforce)) missing.add("Workforce availability");

  const calculable = positive(capacity) && positive(events) && positive(workforce);
  const baseParticipation = calculable
    ? Math.min(capacity!, workforce!) * events!
    : null;
  const participation = calculable
    ? {
        low: Math.floor(Number((baseParticipation! * 0.7).toFixed(8))),
        high: Math.ceil(baseParticipation!),
        unit: "people_per_year" as const,
      }
    : null;
  const staffHours = calculable
    ? {
        low: Math.ceil(participation!.low * 0.5),
        high: Math.ceil(participation!.high * 1.25),
        unit: "hours_per_year" as const,
      }
    : null;

  return {
    contractVersion: SCENARIO_CONTRACT_VERSION,
    modelVersion: SCENARIO_MODEL_VERSION,
    createdAt: input.createdAt,
    assumptionOwner: input.assumptionOwner,
    inputs: input.inputs,
    formulas: calculable
      ? [
          {
            output: "participation_range",
            expression: "min(verified_partner_capacity, workforce_availability) × event_frequency × 0.70–1.00",
            unit: "people_per_year",
          },
          {
            output: "staff_hour_range",
            expression: "participation_range × 0.50–1.25",
            unit: "hours_per_year",
          },
        ]
      : [],
    evidenceUsed: [...new Set(input.evidenceUsed)],
    evidenceMissing: [...missing],
    range: { participation, staffHours },
    hubMix: input.inputs.hubLocations,
    measurementPlan: [
      "Record participation without collecting clinical information.",
      "Track completed non-clinical pathway connections by agreed reporting period.",
      "Review partner capacity and staffing assumptions before each reporting cycle.",
      "Compare observed activity with the scenario range; do not describe the range as a prediction.",
    ],
    humanReviewStatus: input.humanReviewStatus ?? "not_reviewed",
    disclosure: calculable
      ? "This is a versioned planning range based on named assumptions. It is not a prediction or promised result."
      : REACH_NOT_CALCULATED,
  };
}
