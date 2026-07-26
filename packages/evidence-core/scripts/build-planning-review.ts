import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PILOT_PLANNING_REVIEW_BUNDLES } from "../src/planning/pilot-evidence.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const reviewPath = resolve(packageRoot, "review", "milestone-3-pilot-evidence-review.json");
const reportPath = resolve(repoRoot, "docs", "milestone-3-cha-chip-evidence-pipeline.md");

const placeName = (candidateId: string) => {
  if (candidateId.includes("albany")) return "Albany County, New York";
  if (candidateId.includes("schenectady")) return "Schenectady County, New York";
  if (candidateId.includes("st-marys")) return "Montgomery County, New York evaluation";
  if (candidateId.includes("chester")) return "Chester County, Pennsylvania";
  return "Bexar County, Texas";
};

const json = {
  schemaVersion: "planning-evidence-review.v1",
  generatedAt: "2026-07-21T23:45:00Z",
  publicEligibility: false,
  notice: "Internal review artifact. No claim or current-plan designation may be published until its review status is verified by a named human reviewer.",
  bundles: PILOT_PLANNING_REVIEW_BUNDLES,
};

const sections = PILOT_PLANNING_REVIEW_BUNDLES.map((bundle) => {
  const accepted = bundle.acceptedClaims.map((claim) => {
    const citation = bundle.acceptedCitations.find((item) => item.claimId === claim.id);
    const locator = citation?.pageNumber
      ? `printed page ${citation.pageNumber}, PDF page index ${citation.artifactPageIndex ?? "not recorded"}, ${citation.section}`
      : citation?.section ?? "locator missing";
    return `- **${claim.claimType.replaceAll("_", " ")}**: ${claim.statement}\n  - Exact source text: “${claim.exactExcerpt}”\n  - Citation: [official source](${bundle.candidate.artifactUrl}), ${locator}.\n  - Status: source text matched; formal human verification pending.`;
  }).join("\n");
  const tasks = bundle.reviewTasks.map((task) => `- ${task.summary} (${task.reason}; ${task.severity})`).join("\n");
  const cycle = bundle.candidate.planCycleStart && bundle.candidate.planCycleEnd
    ? `${bundle.candidate.planCycleStart} through ${bundle.candidate.planCycleEnd}`
    : "not stated in the candidate record";
  return `## ${placeName(bundle.candidate.id)}\n\n### Document record\n\n- Publisher: ${bundle.candidate.publisher}.\n- Document: [${bundle.candidate.title}](${bundle.candidate.artifactUrl}).\n- Official discovery page: [publisher page](${bundle.candidate.sourcePageUrl}).\n- Type and scope: ${bundle.candidate.documentType.toUpperCase()}, ${bundle.candidate.coverageScope.replaceAll("_", " ")}.\n- Covered geography IDs: ${bundle.candidate.coveredGeographyIds.join(", ")}.\n- Publication date: ${bundle.candidate.publicationDate ?? "not stated"} (${bundle.candidate.publicationDatePrecision} precision).\n- Plan cycle: ${cycle}.\n- Retrieved: ${bundle.candidate.retrievedAt}.\n- Candidate confidence: ${bundle.candidate.candidateConfidence} (${bundle.candidate.candidateConfidenceScore}).\n\n### Source-text-verified extraction\n\n${accepted || "- No extraction passed source-text validation."}\n\n### Awaiting human review\n\n${tasks || "- No open review tasks."}\n\n### Scope guard\n\n- Document scope: ${bundle.candidate.coverageScope.replaceAll("_", " ")}.\n- Public eligibility: no.\n- Current county plan: not verified by this workflow.`;
}).join("\n\n");

const report = `# Milestone 3 - CHA/CHIP evidence pipeline\n\n## Outcome\n\nA controlled, nationwide-ready planning-document workflow now separates discovery, source validation, document scope, extraction, exact citation, formal human review, and current-plan designation. The public interface was not changed. No migration was applied to a live database and nothing was deployed.\n\n## Approved discovery boundary\n\nCandidate discovery accepts only state clearinghouses, county or local health departments, regional planning collaboratives, and hospital CHNA/CSP pages. Each candidate retains publisher, approved host, source page, artifact URL, covered geography, scope, publication-date precision, plan cycle, retrieval date, and confidence. Arbitrary web results cannot enter the adapter.\n\n## Review and publication boundary\n\n- Structured extraction preserves exact source text plus PDF page or HTML section.\n- Priority, objective, intervention, responsible-partner, target-population, and evaluation-measure claims must be explicit in the source.\n- Low-confidence, ambiguous, or mismatched extraction is quarantined.\n- Accepted extraction remains provisional until a named human reviewer records a decision.\n- Only a verified, county-specific CHIP with no open blocking review tasks can be designated as a current county plan.\n- Regional CHNAs, hospital CHNAs, and hospital implementation strategies cannot be promoted as county plans.\n\n## Pilot evidence review\n\n${sections}\n\n## Albany validation\n\nAlbany County's official Data & Statistics page links the 2025 Capital Region Community Health Needs Assessment. The pilot extraction uses the assessment's Albany-specific findings, including cost-related forgone care and the reported racial disparity in diabetes hospitalizations. It does not substitute CDC PLACES rankings for local planning evidence, and it does not call the regional CHNA a current Albany County CHIP. The county page still lists the 2022-2024 CHIP separately; current county-plan status therefore remains not yet verified.\n\n## Refresh, storage, and audit\n\n1. A scheduled monthly discovery review checks approved official source pages only.\n2. New or changed artifacts are retrieved, SHA-256 fingerprinted, and stored as immutable source versions.\n3. PDF or HTML text is normalized into page or section records without discarding original locators.\n4. Structured proposals are validated against the retained page text.\n5. Quarantined proposals and all provisional accepted claims appear in the internal review queue.\n6. Human decisions require reviewer identity, timestamp, and a decision note.\n7. Current-plan promotion is blocked at both application and database layers unless verification conditions pass.\n8. Audit events remain append-only; source versions and prior decisions are never overwritten.\n\n## Pilot limitations\n\n- The Capital Region assessment states publication as October 2025 without an exact day; date precision is recorded as month.\n- Montgomery's 2024 St. Mary's CHNA is service-area and hospital-specific evidence spanning Fulton and Montgomery Counties, not a county plan.\n- Chester County's 2025 CHA is verified as an official county assessment, while the county page describes CHIP development as the next step.\n- Bexar evidence includes the 2025 county CHNA summary embedded in University Health's board-approved 2026-2028 hospital implementation strategy; that strategy is not labeled as Bexar County's plan.\n\n## Operations performed\n\n- Added migration 0003, but did not apply it to any database.\n- Downloaded official artifacts only to the ignored local tmp directory for fingerprinting and text verification.\n- Generated this internal report and the machine-readable review bundle.\n`;

mkdirSync(dirname(reviewPath), { recursive: true });
writeFileSync(reviewPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
writeFileSync(reportPath, report, "utf8");

console.log(JSON.stringify({ reviewPath, reportPath, bundles: PILOT_PLANNING_REVIEW_BUNDLES.length }, null, 2));
