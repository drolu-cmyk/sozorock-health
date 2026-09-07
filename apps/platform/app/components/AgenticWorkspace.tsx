"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeographyProfile } from "../lib/types";
import {
  approveExactCbcapRun,
  createVisualizationSpec,
  getAgenticHealth,
  getWorkspaceCapabilities,
  type WorkspaceCapabilities,
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
import { agenticRuntimeConfig } from "../lib/agentic-runtime";

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
    awaiting_human_review: "Review Required",
    approved_output: "Reviewed Brief",
    needs_place_selection: "County selection required",
    evidence_unavailable: "Evidence unavailable",
    blocked: "Review conditions not met",
    error: "Planning review unavailable",
  };
  return status ? labels[status] || status : "Ready to begin";
}

function RunStages({ run }: { run: CbcapRun }) {
  const stages: Array<[string, string]> = [
    ["County selected", String(record(run.placeResolution)?.status || "not returned")],
    ["Evidence reviewed", run.evidence ? "returned" : "not returned"],
    ["Access barriers", run.barriers ? "returned" : "not returned"],
    ["Draft brief", run.draft ? "returned" : "not returned"],
    ["Human review", run.status === "approved_output" ? "approved" : run.status === "awaiting_human_review" ? "required" : "not available"],
  ];
  return <ol className="agentic-stages">{stages.map(([label, state]) => <li key={label}><strong>{label}</strong><span>{String(state).replaceAll("_", " ")}</span></li>)}</ol>;
}

export function AgenticWorkspace({ profile }: { profile: GeographyProfile | null }) {
  const config = useMemo(() => agenticRuntimeConfig(), []);
  const county = profile?.kind === "county" ? profile : null;
  const countyGeoid = county?.geoid || null;
  const contextVersion = useRef(0);
  const [capabilities, setCapabilities] = useState<WorkspaceCapabilities | null>(null);
  const [area, setArea] = useState("Overview");
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
      } catch {
        if (!cancelled) setMessage("Sign-in could not be completed. Please try again.");
      }
    }).catch(() => {
      if (cancelled) return;
      setRuntimeState("unavailable");
      setMessage("The Planning Workspace is temporarily unavailable.");
    }).finally(() => { if (!cancelled) setBusy(null); });
    return () => { cancelled = true; };
  }, [config]);

  useEffect(() => {
    let cancelled = false;
    setCapabilities(null);
    setArea("Overview");
    if (!signedIn || !countyGeoid || runtimeState !== "ready") return;
    void getWorkspaceCapabilities(config, countyGeoid).then(value => {
      if (!cancelled) setCapabilities(value);
    }).catch(() => { if (!cancelled) setMessage("Available planning actions could not be confirmed. The county evidence remains available."); });
    return () => { cancelled = true; };
  }, [config, countyGeoid, signedIn, runtimeState]);

  async function signIn() {
    setMessage("");
    setBusy("auth");
    try { await beginCognitoSignIn(config); }
    catch {
      setBusy(null);
      setMessage("Sign-in could not start. Please try again.");
    }
  }

  function signOut() {
    contextVersion.current += 1;
    setBusy(null);
    setMessage("");
    setRun(null);
    setRunCountyGeoid(null);
    setVisualization(null);
    setSignedIn(false);
    setCapabilities(null);
    endCognitoSession(config);
  }

  async function startRun() {
    if (capabilities?.capabilities.planning !== true) return setMessage("Planning review is not available for your access and this county evidence.");
    if (!county) return setMessage("Select a county before starting a planning review.");
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
    catch { if (contextVersion.current !== initiatingContext) return; setMessage("The planning review could not start. Check your access and try again."); }
    finally { if (contextVersion.current === initiatingContext) setBusy(null); }
  }

  async function approveRun(runId: string) {
    if (capabilities?.capabilities.review !== true) return setMessage("Your access does not permit this review.");
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
    catch { if (contextVersion.current !== initiatingContext) return; setMessage("This saved brief could not be reviewed. Your access or its review state may have changed."); }
    finally { if (contextVersion.current === initiatingContext) setBusy(null); }
  }

  async function requestVisualization() {
    if (capabilities?.capabilities.visualization !== true) return setMessage("A comparison is not available for this evidence.");
    if (!run || !countyGeoid || runCountyGeoid !== countyGeoid) return setMessage("Start a planning review before comparing evidence.");
    const initiatingContext = contextVersion.current;
    setBusy("visual");
    setMessage("");
    try {
      const nextVisualization = await createVisualizationSpec(config, run);
      if (contextVersion.current !== initiatingContext) return;
      setVisualization(nextVisualization);
    }
    catch { if (contextVersion.current !== initiatingContext) return; setMessage("The evidence comparison is unavailable."); }
    finally { if (contextVersion.current === initiatingContext) setBusy(null); }
  }

  const reviewableRunId = runCountyGeoid === countyGeoid && run?.status === "awaiting_human_review" && typeof run.runId === "string" ? run.runId : null;
  const citations = citationsFrom(run);
  const tools = agentToolCalls(run);
  const canOperate = runtimeState === "ready" && signedIn;

  return (
    <section className="agentic-workspace planning-room" id="agentic-workspace" aria-labelledby="agentic-workspace-heading">
      <header className="workspace-heading"><div><span>Planning Workspace</span><h2 id="agentic-workspace-heading">Bring the evidence into your plan.</h2></div><p>Start with a county. Review the evidence, draft planning questions and keep the brief tied to its sources. AI drafts. People decide.</p></header>
      {runtimeState === "disabled" && <div className="agentic-notice" role="status"><strong>Institutional access is not available in this release.</strong><p>You can still use the <a href="/#county">Public Evidence Preview</a>.</p></div>}
      {runtimeState === "checking" && <div className="agentic-notice" role="status">Checking workspace availability…</div>}
      {runtimeState === "unavailable" && <div className="agentic-notice" role="status"><strong>Planning Workspace is temporarily unavailable.</strong><p>The <a href="/#county">Public Evidence Preview</a> remains open.</p></div>}
      {runtimeState === "ready" && <div className="agentic-shell">
        <aside className="agentic-context"><span>County</span><h3>{county?.name || "Select a county"}</h3><p>{county?.context || "Choose a county above to begin. City and ZIP-linked evidence are not silently assigned to a county."}</p>
          {!signedIn ? <button type="button" onClick={() => void signIn()} disabled={busy === "auth"}>{busy === "auth" ? "Preparing sign-in…" : "Sign in"}</button> : <><button type="button" onClick={() => void startRun()} disabled={!county || capabilities?.capabilities.planning !== true || Boolean(busy)}>{busy === "run" ? "Preparing your review…" : "Start planning review"}</button><button type="button" className="agentic-secondary" onClick={signOut}>Sign out</button></>}
        </aside>
        <div className="agentic-run" aria-live="polite">{signedIn && <nav className="planning-navigation" aria-label="Planning Workspace">{["Overview", "Evidence", "Plan", "Resources", "Monitor", "Governance"].map(label => <button type="button" key={label} aria-pressed={area === label} onClick={() => setArea(label)}>{label}</button>)}</nav>}
          {signedIn && ["Resources", "Monitor"].includes(area) && <div className="agentic-notice"><h3>{area === "Resources" ? "Can we support the plan?" : "What needs another look?"}</h3><p>{area === "Resources" ? "Resource actions appear only after your organization has reviewed evidence, authorized access and active sources. No resource recommendation has been made." : "No active monitoring view has been confirmed for this county. A missing event does not mean nothing has changed."}</p></div>}
          {signedIn && area === "Evidence" && <p>Where did this come from? County estimates and their sources are above. Sources returned with a planning review appear beside the brief.</p>}
          {signedIn && area === "Governance" && <p>Review the saved brief and its sources. Audit details below preserve the exact county and saved review reference.</p>}<div className="agentic-run__status"><span>Review state</span><strong>{statusLabel(run?.status)}</strong></div>
          {message && <p role="alert">{message}</p>}
          {!run && <p className="agentic-empty">What evidence belongs in your plan? Sign in and start a planning review for the selected county.</p>}
          {signedIn && run && <><RunStages run={run} />
            <PlanningBrief value={run.status === "approved_output" ? run.output : run.draft} />
            {citations.length > 0 && <div className="agentic-citations" id="workspace-sources"><h3>Sources</h3><ul>{citations.map(citation => <li key={citation.url}><a href={citation.url} target="_blank" rel="noreferrer">{citation.label}</a></li>)}</ul></div>}
            {reviewableRunId && health?.reviewContinuationEnabled && capabilities?.capabilities.review === true && <div className="agentic-review"><strong>Review Required</strong><p>Confirm that you have reviewed this brief, its evidence and assumptions. Your review applies only to this saved version and does not publish externally.</p><button type="button" onClick={() => void approveRun(reviewableRunId)} disabled={Boolean(busy)}>{busy === "review" ? "Recording review…" : "Mark this brief reviewed"}</button></div>}
            {health?.visualizationIntelligenceRouteEnabled && capabilities?.capabilities.visualization === true && <div className="agentic-visual"><button type="button" onClick={() => void requestVisualization()} disabled={!canOperate || Boolean(busy)}>{busy === "visual" ? "Preparing comparison…" : "Compare the evidence"}</button>{visualization && <p>{visualization.status === "renderable" ? "Comparison requirements are available in the technical details. Source estimates remain above." : "A compatible comparison is not available for this evidence."}</p>}</div>}
            <details className="agentic-artifact"><summary>Audit details</summary><dl><dt>Saved review reference</dt><dd><code>{run.runId}</code></dd><dt>County reference</dt><dd>{runCountyGeoid}</dd></dl>{tools.length > 0 && <details><summary>Technical details</summary><ul>{tools.map(tool => <li key={tool}><code>{tool}</code></li>)}</ul></details>}<details><summary>Source and review record</summary><pre>{JSON.stringify({ status: run.status, draft: run.draft, output: run.output, comparison: visualization }, null, 2)}</pre></details></details>
          </>}
        </div>
      </div>}
    </section>
  );
}

function PlanningBrief({ value }: { value: unknown }) {
  const brief = record(value);
  if (!brief) return <p>No brief has been returned for this review.</p>;
  const observed = Array.isArray(brief.observedPathwayEvidence) ? brief.observedPathwayEvidence.map(record).filter(Boolean) : [];
  const missing = Array.isArray(brief.unavailablePathwayEvidence) ? brief.unavailablePathwayEvidence.map(record).filter(Boolean) : [];
  const questions = Array.isArray(brief.planningQuestions) ? brief.planningQuestions.filter((item): item is string => typeof item === "string") : [];
  return <article className="planning-brief"><h3>Access barriers</h3>{observed.length ? <dl>{observed.map((item, index) => <div key={String(item?.key || index)}><dt>{String(item?.label || "Source estimate")}</dt><dd>{typeof item?.value === "number" ? `${item.value} ${String(item.unit || "")}` : "Not available"}</dd><dd>{String(item?.universe || "Population not specified")}</dd></div>)}</dl> : <p>No compatible source estimates were returned.</p>}{missing.length > 0 && <><h3>Evidence gaps</h3><ul>{missing.map((item, index) => <li key={index}>{String(item?.label || "Evidence")}: Not found in reviewed evidence.</li>)}</ul></>}{questions.length > 0 && <><h3>Planning questions</h3><ul>{questions.map(question => <li key={question}>{question}</li>)}</ul></>}<p>Review sources and local context before choosing a response.</p></article>;
}
