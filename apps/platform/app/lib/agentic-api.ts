import { getInMemoryAccessToken } from "./agentic-auth";
import { agenticApiUrl, type AgenticRuntimeConfig } from "./agentic-runtime";

export type AgenticHealth = {
  status: "ok";
  runtime: "governed-graph";
  institutionalAccessEnabled: boolean;
  reviewContinuationEnabled: boolean;
  visualizationIntelligenceRouteEnabled: boolean;
};

export type CbcapRun = Record<string, unknown> & {
  runId?: string;
  status?: "awaiting_human_review" | "approved_output" | "needs_place_selection" | "evidence_unavailable" | "blocked" | "error";
  placeResolution?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  barriers?: Record<string, unknown>;
  planning?: Record<string, unknown>;
  draft?: Record<string, unknown>;
  output?: Record<string, unknown>;
};

export type VisualizationSpec = Record<string, unknown> & {
  contract?: string;
  status?: "renderable" | "fallback_required" | "blocked";
  insightTitle?: string;
  primaryRoute?: string;
  fallbackRoute?: string;
  renderer?: string;
  requiredDisclosures?: unknown[];
};

async function responseJson(response: Response) {
  return response.json().catch(() => ({ error: "The agentic runtime returned an unreadable response." })) as Promise<Record<string, unknown>>;
}

function messageForFailure(status: number, body: Record<string, unknown>) {
  if (typeof body.error === "string" && body.error.trim()) return body.error;
  if (body.error && typeof body.error === "object" && typeof (body.error as Record<string, unknown>).reason === "string") {
    return (body.error as Record<string, unknown>).reason as string;
  }
  if (status === 401 || status === 403) return "Your workspace is not authorized for this action.";
  if (status === 409) return "This run cannot continue from its current saved state.";
  if (status === 422) return "The governed runtime blocked this request because its evidence conditions were not met.";
  if (status === 502 || status === 503) return "The governed runtime or evidence source is currently unavailable.";
  return "The agentic request could not be completed.";
}

export async function getAgenticHealth(): Promise<AgenticHealth> {
  const response = await fetch(agenticApiUrl("/api/health"), { headers: { Accept: "application/json" }, cache: "no-store" });
  const body = await responseJson(response);
  if (!response.ok || body.status !== "ok" || body.runtime !== "governed-graph") throw new Error("The governed agentic runtime is unavailable.");
  return body as AgenticHealth;
}

async function post<T>(config: AgenticRuntimeConfig, path: string, payload: Record<string, unknown>, accepted: number[]) {
  const token = await getInMemoryAccessToken(config);
  const response = await fetch(agenticApiUrl(path), {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "omit",
  });
  const body = await responseJson(response);
  if (!response.ok && !accepted.includes(response.status)) throw new Error(messageForFailure(response.status, body));
  return body as T;
}

export function startCbcapRun(config: AgenticRuntimeConfig, location: string) {
  return post<CbcapRun>(config, "/api/cbcap", { location }, [202, 409]);
}

export function approveExactCbcapRun(config: AgenticRuntimeConfig, runId: string) {
  if (!runId || runId.length > 128) throw new Error("The saved run ID is invalid.");
  return post<CbcapRun>(config, `/api/cbcap/runs/${encodeURIComponent(runId)}/review`, { decision: "approve" }, [200]);
}

export function createVisualizationSpec(config: AgenticRuntimeConfig, run: CbcapRun) {
  const barrierGroups = run.barriers && typeof run.barriers === "object"
    ? (run.barriers as Record<string, unknown>).pathwayBarriers
    : null;
  const itemCount = barrierGroups && typeof barrierGroups === "object" && !Array.isArray(barrierGroups)
    ? Object.keys(barrierGroups).length
    : 0;
  return post<VisualizationSpec>(config, "/api/cbcap/visualizations/spec", {
    question: "barrier_matrix",
    geographyKind: "county",
    itemCount,
    hasMissingValues: JSON.stringify(run.barriers || {}).includes("no_verified_data"),
  }, [200]);
}
