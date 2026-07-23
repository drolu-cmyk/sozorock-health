import type {
  NationalOperationsReport,
  OperationalControl,
  PlaceAcceptanceResult,
} from "./types.ts";
import { PLACE_EVIDENCE_OPERATING_POLICY_VERSION } from "./policy.ts";

export function buildNationalOperationsReport({
  evaluatedAt,
  controls,
  places,
}: {
  evaluatedAt: string;
  controls: OperationalControl[];
  places: PlaceAcceptanceResult[];
}): NationalOperationsReport {
  const blockingControlIds = controls
    .filter((control) => control.releaseBlocking && control.status !== "pass")
    .map((control) => control.id);
  const warningCount = controls.filter((control) => control.status === "warning").length;
  return {
    evaluatedAt,
    policyVersion: PLACE_EVIDENCE_OPERATING_POLICY_VERSION,
    releaseRecommendation:
      blockingControlIds.length > 0 ? "no_go" : warningCount > 0 ? "conditional_go" : "go",
    controls,
    places,
    blockingControlIds,
  };
}

export function validateOperationalControl(control: OperationalControl) {
  if (!control.id.trim()) throw new Error("Operational control ID is required.");
  if (control.evidence.length === 0) throw new Error(`${control.id} requires evidence.`);
  if (control.status !== "pass" && !control.requiredAction) {
    throw new Error(`${control.id} requires a corrective action.`);
  }
  return control;
}
