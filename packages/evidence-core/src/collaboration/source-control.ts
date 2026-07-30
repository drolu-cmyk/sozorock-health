import type {
  SourceAdapterContract,
  SourceCandidateAssessment,
} from "./types.ts";

type CandidateRelease = {
  officialUrl: string;
  schemaFingerprint: string;
  priorRecordCount: number;
  candidateRecordCount: number;
  retrievalSucceeded: boolean;
  withdrawn: boolean;
};

function host(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function assessSourceCandidate(
  contract: SourceAdapterContract,
  candidate: CandidateRelease,
): SourceCandidateAssessment {
  const findings: string[] = [];
  let status: SourceCandidateAssessment["status"] = "validated";
  const candidateHost = host(candidate.officialUrl);
  const isApprovedHost = contract.officialHostAllowlist.some((rule) =>
    rule.startsWith(".") ? candidateHost.endsWith(rule) : candidateHost === rule,
  );
  if (!isApprovedHost) {
    status = "retrieval_failed";
    findings.push("Candidate URL is outside the approved official-host allowlist.");
  } else if (!candidate.retrievalSucceeded) {
    status = "retrieval_failed";
    findings.push("Candidate release could not be retrieved or validated.");
  } else if (candidate.withdrawn) {
    status = "withdrawn";
    findings.push("The publisher withdrew the candidate release.");
  } else if (candidate.schemaFingerprint !== contract.schemaFingerprint) {
    status = "schema_drift";
    findings.push("The candidate schema differs from the approved contract.");
  } else if (
    candidate.priorRecordCount > 0
    && candidate.candidateRecordCount < Math.floor(candidate.priorRecordCount * 0.95)
  ) {
    status = "coverage_regression";
    findings.push("Candidate coverage is more than five percent below the last approved release.");
  } else {
    status = "awaiting_review";
    findings.push("Contract validation passed; a human reviewer must approve publication.");
  }
  return {
    sourceId: contract.sourceId,
    contractVersion: contract.contractVersion,
    status,
    publishable: false,
    requiresHumanApproval: true,
    findings,
  };
}
