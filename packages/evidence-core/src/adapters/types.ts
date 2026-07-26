import type {
  IngestionRun,
  SourceCatalogRecord,
  SourceFamily,
} from "../contracts.ts";

export type AdapterRequest = {
  url: string;
  method: "GET";
  purpose: string;
  expectedMediaTypes: string[];
};

export type AdapterReleasePlan = {
  adapterId: string;
  sourceId: string;
  releaseLabel: string;
  requests: AdapterRequest[];
  requiresHumanReview: boolean;
  notes: string[];
};

export type SourceAdapter<TInput> = {
  id: string;
  family: SourceFamily;
  sourceId: string;
  buildReleasePlan(input: TInput): AdapterReleasePlan;
};

export function validateAdapterRequest(
  request: AdapterRequest,
  source: SourceCatalogRecord,
) {
  const errors: string[] = [];
  if (source.hostPolicy === "reviewer_approved_per_document") {
    return {
      valid: false,
      errors: ["This source family requires the document-specific adapter and a reviewer-approved publisher host."],
    };
  }
  let hostname = "";
  try {
    const url = new URL(request.url);
    hostname = url.hostname;
    if (url.protocol !== "https:") errors.push("Adapter requests must use HTTPS.");
  } catch {
    errors.push("Adapter request URL is invalid.");
  }
  if (hostname && !source.allowedHosts.some((allowed) => (
    hostname === allowed || hostname.endsWith(`.${allowed}`)
  ))) errors.push(`Adapter request host ${hostname} is not approved for ${source.id}.`);
  if (request.method !== "GET") errors.push("Source adapters are read-only.");
  if (!request.purpose.trim()) errors.push("Adapter requests require a declared purpose.");
  return { valid: errors.length === 0, errors };
}

export function newIngestionRun(
  adapterId: string,
  sourceId: string,
  runId: string,
  startedAt: string,
): IngestionRun {
  return {
    id: runId,
    adapterId,
    sourceId,
    startedAt,
    completedAt: null,
    status: "started",
    inputHash: null,
    outputHash: null,
    recordsRead: 0,
    recordsAccepted: 0,
    recordsRejected: 0,
    errorSummary: null,
  };
}
