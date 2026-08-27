"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeographyProfile } from "../lib/types";
import {
  approveExactCbcapRun,
  createVisualizationSpec,
  getAgenticHealth,
  startCbcapRun,
  type AgenticHealth,
  type CbcapRun,
  type VisualizationSpec,
} from "../lib/agentic-api";
import {
  beginCognitoSignIn,
  completeCognitoCallback,
  endCognitoSession,
  hasInMemorySession,
} from "../lib/agentic-auth";
import { agenticRuntimeConfig, CBCAP_AGENTIC_API_ORIGIN } from "../lib/agentic-runtime";

type Citation = { label: string; url: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function citationUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

function citationsFrom(value: unknown) {
  const found = new Map<string, Citation>();
  function visit(node: unknown) {
    if (Array.isArray(node)) return node.forEach(visit);
    const item = record(node);
    if (!item) return;
    const url = [item.url, item.sourceUrl, item.source_url, item.officialUrl, item.official_url]
      .map(citationUrl)
      .find((candidate) => candidate !== null);
    if (url) {
      const label = [item.title, item.label, item.source, item.dataset].find((candidate) => typeof candidate === "string" && candidate.trim()) as string | undefined;
      found.set(url.href, { url: url.href, label: label || url.hostname });
    }
    Object.values(item).forEach(visit);
  }
  visit(value);
  return [...found.values()];
}

function agentToolCalls(run: CbcapRun | null) {
  const draft = record(run?.draft);
  const assistance = record(draft?.agentAssistance);
  const trace = record(assistance?.trace);
  return Array.isArray(trace?.toolCalls) ? trace.toolCalls.filter((item): item is string => typeof item === "string") : [];
}

function statusLabel(status: CbcapRun["status"] | undefined) {
  const labels: Record<string, string> = {
    awaiting_human_review: "Awaiting human review",
    approved_output: "Approved output",
    needs_place_selection: "County selection required",
    evidence_unavailable: "Evidence unavailable",
    blocked: "Blocked by governance",
    error: "Run error",
  };
  return status ? labels[status] || status : "No run started";
}

function RunStages({ run }: { run: CbcapRun }) {
  const stages: Array<[string, string]> = [
    ["County resolution", String(record(run.placeResolution)?.status || "not returned")],
    ["Governed evidence", run.evidence ? "returned" : "not returned"],
    ["Barrier synthesis", run.barriers ? "returned" : "not returned"],
    ["Planning draft", run.draft ? "returned" : "not returned"],
    ["Human review", run.status === "approved_output" ? "approved" : run.status === "awaiting_human_review" ? "required" : "not available"],
  ];
  return <ol className="agentic-stages">{stages.map(([label, state]) => <li key={label}><strong>{label}</strong><span>{String(state).replaceAll("_", " ")}</span></li>)}</ol>;
}

export function AgenticWorkspace({ profile }: { profile: GeographyProfile | null }) {
  const config = useMemo(() => agenticRuntimeConfig(), []);
  const county = profile?.kind === "county" ? profile : null;
  const countyGeoid = county?.geoid || null;
  const contextVersion = useRef(0);
  const [health, setHealth] = useState<AgenticHealth | null>(null);
  const [runtimeState, setRuntimeState] = useState<"disabled" | "checking" | "ready" | "unavailable">(config.enabled ? "checking" : "disabled");
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState<"auth" | "run" | "review" | "visual" | null>(null);
  const [message, setMessage] = useState("");
  const [run, setRun] = useState<CbcapRun | null>(null);
  const [runCountyGeoid, setRunCountyGeoid] = useState<string | null>(null);
  const [visualization, setVisualization] = useState<VisualizationSpec | null>(null);

  useEffect(() => {
    contextVersion.current += 1;
    setRun(null);
    setRunCountyGeoid(null);
    setVisualization(null);
  }, [countyGeoid]);

  useEffect(() => {
    if (!config.enabled) return;
    let cancelled = false;
    setBusy("auth");
    void getAgenticHealth().then(async (service) => {
      if (cancelled) return;
      setHealth(service);
      setRuntimeState(service.institutionalAccessEnabled ? "ready" : "unavailable");
      try {
        const completed = await completeCognitoCallback(config);
        if (!cancelled) setSignedIn(completed || hasInMemorySession());
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Institutional sign-in could not be completed.");
      }
    }).catch((error: unknown) => {
      if (cancelled) return;
      setRuntimeState("unavailable");
      setMessage(error instanceof Error ? error.message : "The governed workspace is unavailable.");
    }).finally(() => { if (!cancelled) setBusy(null); });
    return () => { cancelled = true; };
  }, [config]);

  async function signIn() {
    setMessage("");
    setBusy("auth");
    try { await beginCognitoSignIn(config); }
    catch (error) {
      setBusy(null);
      setMessage(error instanceof Error ? error.message : "Institutional sign-in could not start.");
    }
  }

  function signOut() {
    setRun(null);
    setRunCountyGeoid(null);
    setVisualization(null);
    setSignedIn(false);
    endCognitoSession(config);
  }

  async function startRun() {
    if (!county) return setMessage("Select a county profile before starting a governed run.");
    const initiatingGeoid = county.geoid;
    const initiatingContext = contextVersion.current;
    setBusy("run");
    setMessage("");
    setRun(null);
    setRunCountyGeoid(null);
    setVisualization(null);
    try {
      const nextRun = await startCbcapRun(config, initiatingGeoid);
      if (contextVersion.current !== initiatingContext) return;
      setRun(nextRun);
      setRunCountyGeoid(initiatingGeoid);
    }
    catch (error) { setMessage(error instanceof Error ? error.message : "The governed run could not start."); }
    finally { setBusy(null); }
  }

  async function approveRun(runId: string) {
    if (run?.runId !== runId || run.status !== "awaiting_human_review" || !countyGeoid || runCountyGeoid !== countyGeoid) {
      return setMessage("The displayed draft no longer matches the saved run selected for review.");
    }
    const initiatingContext = contextVersion.current;
    setBusy("review");
    setMessage("");
    try {
      const approvedRun = await approveExactCbcapRun(config, runId);
      if (contextVersion.current !== initiatingContext) return;
      setRun(approvedRun);
    }
    catch (error) { setMessage(error instanceof Error ? error.message : "The exact saved run could not be reviewed."); }
    finally { setBusy(null); }
  }

  async function requestVisualization() {
    if (!run || !countyGeoid || runCountyGeoid !== countyGeoid) return setMessage("Start a governed county run before requesting a visualization specification.");
    const initiatingContext = contextVersion.current;
    setBusy("visual");
    setMessage("");
    try {
      const nextVisualization = await createVisualizationSpec(config, run);
      if (contextVersion.current !== initiatingContext) return;
      setVisualization(nextVisualization);
    }
    catch (error) { setMessage(error instanceof Error ? error.message : "A governed visualization specification is unavailable."); }
    finally { setBusy(null); }
  }

  const reviewableRunId = runCountyGeoid === countyGeoid && run?.status === "awaiting_human_review" && typeof run.runId === "string" ? run.runId : null;
  const citations = citationsFrom(run);
  const tools = agentToolCalls(run);
  const canOperate = runtimeState === "ready" && signedIn;

  return (
    <section className="agentic-workspace" id="agentic-workspace" aria-labelledby="agentic-workspace-heading">
      <header className="workspace-heading">
        <div><span>Institutional agentic workspace</span><h2 id="agentic-workspace-heading">Run a governed county planning draft.</h2></div>
        <p>Authenticated runs use the governed graph at <code>{CBCAP_AGENTIC_API_ORIGIN}</code>. Drafts remain bound to their evidence and require exact-run human approval.</p>
      </header>

      {runtimeState === "disabled" && <div className="agentic-notice" role="status"><strong>Agentic controls are disabled.</strong><p>Cognito and runtime configuration are not present or the API origin is not the approved production origin. The public dashboard remains available.</p></div>}
      {runtimeState === "checking" && <div className="agentic-notice" role="status">Checking the governed runtime and sign-in callback…</div>}
      {runtimeState === "unavailable" && <div className="agentic-notice agentic-notice--error" role="alert"><strong>Institutional runtime unavailable.</strong><p>{message || "The service did not confirm institutional access."}</p></div>}

      {runtimeState === "ready" && (
        <div className="agentic-shell">
          <aside className="agentic-context">
            <span>County handoff</span>
            <h3>{county?.name || "Select a county"}</h3>
            <p>{county ? `${county.context} · GEOID ${county.geoid}` : "State, place, ZIP-linked, and community profiles are not silently converted into a county run."}</p>
            {!signedIn
              ? <button type="button" onClick={() => void signIn()} disabled={busy === "auth"}>{busy === "auth" ? "Preparing sign-in…" : "Sign in with Cognito"}</button>
              : <><button type="button" onClick={() => void startRun()} disabled={!county || Boolean(busy)}>{busy === "run" ? "Starting governed run…" : "Start county planning run"}</button><button className="agentic-secondary" type="button" onClick={signOut}>Sign out</button></>}
            <small>OAuth authorization code with PKCE. Access and refresh tokens remain in memory and are never stored in localStorage or placed in the page URL.</small>
          </aside>

          <div className="agentic-run" aria-live="polite">
            <div className="agentic-run__status"><span>Run status</span><strong>{statusLabel(run?.status)}</strong>{run?.runId && <code>{run.runId}</code>}</div>
            {message && <div className="agentic-message" role="alert">{message}</div>}
            {!run && <p className="agentic-empty">Sign in, select an exact county, and start a run. No output is implied until the runtime returns it.</p>}
            {run && <>
              <RunStages run={run} />
              {tools.length > 0 && <div className="agentic-tools"><h3>Returned agent tool stages</h3><ul>{tools.map((tool) => <li key={tool}><code>{tool}</code></li>)}</ul></div>}
              {run.draft && <details open className="agentic-artifact"><summary>Reviewable draft returned by the run</summary><pre>{JSON.stringify(run.draft, null, 2)}</pre></details>}
              {run.output && <details open className="agentic-artifact"><summary>Approved output returned by the run</summary><pre>{JSON.stringify(run.output, null, 2)}</pre></details>}
              {citations.length > 0 && <div className="agentic-citations"><h3>Returned citations</h3><ul>{citations.map((citation) => <li key={citation.url}><a href={citation.url} target="_blank" rel="noreferrer">{citation.label}</a><small>{citation.url}</small></li>)}</ul></div>}
              {reviewableRunId && health?.reviewContinuationEnabled && <div className="agentic-review"><strong>Human review applies only to saved run <code>{reviewableRunId}</code>.</strong><p>Approval continues that exact checkpoint to the backend’s approved output. It does not publish externally.</p><button type="button" onClick={() => void approveRun(reviewableRunId)} disabled={Boolean(busy)}>{busy === "review" ? "Approving exact run…" : `Approve run ${reviewableRunId}`}</button></div>}
              {health?.visualizationIntelligenceRouteEnabled && <div className="agentic-visual"><button type="button" onClick={() => void requestVisualization()} disabled={!canOperate || Boolean(busy)}>{busy === "visual" ? "Requesting specification…" : "Request governed barrier visualization"}</button>{visualization && <><strong>{visualization.insightTitle || "Visualization specification"}</strong><p>Status: {visualization.status || "not returned"} · Renderer: {visualization.renderer || "not returned"}</p><pre>{JSON.stringify(visualization, null, 2)}</pre></>}</div>}
            </>}
          </div>
        </div>
      )}
    </section>
  );
}
