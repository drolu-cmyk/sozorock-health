import type { PlanningDocumentCandidate, PlanningSourceFamily } from "../contracts.ts";
import { PLANNING_SOURCE_FAMILIES } from "../contracts.ts";
import { validatePlanningCandidate } from "./quality.ts";

export type ApprovedPlanningSourceSeed = {
  sourceFamily: PlanningSourceFamily;
  publisher: string;
  approvedHosts: string[];
  sourcePageUrl: string;
  candidates: PlanningDocumentCandidate[];
};

export type PlanningDiscoveryResult = {
  accepted: PlanningDocumentCandidate[];
  rejected: Array<{
    candidate: PlanningDocumentCandidate;
    errors: string[];
  }>;
};

/**
 * Controlled discovery begins with a reviewer-maintained registry of official
 * publisher pages. It never accepts a search-engine result or an unregistered
 * source family directly into extraction.
 */
export function discoverFromApprovedPlanningSources(
  seeds: ApprovedPlanningSourceSeed[],
): PlanningDiscoveryResult {
  const accepted: PlanningDocumentCandidate[] = [];
  const rejected: PlanningDiscoveryResult["rejected"] = [];

  for (const seed of seeds) {
    if (!PLANNING_SOURCE_FAMILIES.includes(seed.sourceFamily)) {
      for (const candidate of seed.candidates) {
        rejected.push({ candidate, errors: ["Planning source family is not approved."] });
      }
      continue;
    }

    for (const candidate of seed.candidates) {
      const errors: string[] = [];
      if (candidate.sourceFamily !== seed.sourceFamily) {
        errors.push("Candidate source family does not match its approved source seed.");
      }
      if (candidate.publisher !== seed.publisher) {
        errors.push("Candidate publisher does not match its approved source seed.");
      }
      if (candidate.sourcePageUrl !== seed.sourcePageUrl) {
        errors.push("Candidate source page does not match its approved source seed.");
      }
      if (candidate.approvedHosts.some((host) => !seed.approvedHosts.includes(host))) {
        errors.push("Candidate includes a host outside the approved source seed.");
      }
      const validation = validatePlanningCandidate(candidate);
      errors.push(...validation.errors);

      if (errors.length > 0) rejected.push({ candidate, errors: [...new Set(errors)] });
      else accepted.push(candidate);
    }
  }

  return { accepted, rejected };
}
