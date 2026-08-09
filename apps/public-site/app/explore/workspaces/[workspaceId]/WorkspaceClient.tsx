"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import styles from "../workspace.module.css";

type Section = { sectionKey: string; version: number; content: Record<string, unknown>; updatedAt: string };
type Scenario = { id: string; name: string; version: number; status: string; humanReviewStatus: string; output: Record<string, unknown> };
type Plan = {
  contractVersion: string;
  actor: { displayName: string; principalId: string; role: string; access: string };
  workspace: { id: string; title: string; version: number; geoid: string; geographyName: string; updatedAt: string };
  participants: Array<{ principalId: string; displayName: string; role: string; access: string }>;
  sections: Section[];
  comments: Array<{ id: string; sectionKey: string; body: string; actorId: string; createdAt: string }>;
  reviewQuestions: Array<{ id: string; sectionKey: string; question: string; assignedTo: string | null; status: string }>;
  suggestions: Array<{ id: string; sectionKey: string; content: Record<string, unknown>; status: string }>;
  scenarios: Scenario[];
};
type ShareLink = { id: string; scope: string; expiresAt: string; createdAt: string; lastAccessAt: string | null };
type AuditEvent = { sequenceNumber: number; eventType: string; actorType: string; actorReference: string; outcome: string; occurredAt: string; requestHash: string | null; responseHash: string | null };

const key = () => crypto.randomUUID();

export function WorkspaceClient({ workspaceId }: { workspaceId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastSequence, setLastSequence] = useState(0);
  const [inviteLink, setInviteLink] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const response = await fetch(`/api/evidence/v1/workspaces/${workspaceId}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    if (mounted.current) setPlan(body);
  }, [workspaceId]);

  const loadOwnerControls = useCallback(async (nextPlan: Plan) => {
    const membership = nextPlan.participants.find((participant) => participant.principalId === nextPlan.actor.principalId);
    const access = membership?.access ?? "viewer";
    const role = membership?.role ?? "research_funder_viewer";
    if (access === "owner") {
      const response = await fetch(`/api/evidence/v1/workspaces/${workspaceId}/share`, { cache: "no-store" });
      if (response.ok) setShares((await response.json()).links ?? []);
    }
    if (access === "owner" || role === "foundation_reviewer") {
      const response = await fetch(`/api/evidence/v1/workspaces/${workspaceId}/audit`, { cache: "no-store" });
      if (response.ok) setAuditEvents((await response.json()).audit?.workspaceEvents ?? []);
    }
  }, [workspaceId]);

  useEffect(() => {
    mounted.current = true;
    void load().catch((cause) => setError(cause.message));
    return () => { mounted.current = false; };
  }, [load]);

  useEffect(() => {
    if (!plan) return;
    void loadOwnerControls(plan);
    const timer = window.setInterval(() => {
      void fetch(`/api/evidence/v1/workspaces/${workspaceId}/events?after=${lastSequence}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((body) => {
          if (!Array.isArray(body.events) || !body.events.length) return;
          setLastSequence(Math.max(...body.events.map((event: { sequenceNumber: number }) => event.sequenceNumber)));
          void load();
        });
    }, 1_000);
    return () => clearInterval(timer);
  }, [plan, lastSequence, workspaceId, load, loadOwnerControls]);

  async function json(path: string, body: unknown, method = "POST") {
    setError("");
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": key() }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    await load();
    return result;
  }

  async function saveSection(section: Section, body: string) {
    try {
      await json(`/api/evidence/v1/workspaces/${workspaceId}/sections/${section.sectionKey}`, { expectedVersion: section.version, content: { ...section.content, body } }, "PUT");
      setNotice("Plan section saved with a new version.");
    } catch (cause) { setError((cause as Error).message); }
  }

  async function addArtifact(event: FormEvent<HTMLFormElement>, action: "comment" | "review_question") {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await json(`/api/evidence/v1/workspaces/${workspaceId}/artifacts`, action === "comment"
        ? { action, sectionKey: form.get("sectionKey"), body: form.get("body") }
        : { action, sectionKey: form.get("sectionKey"), question: form.get("question"), assignedTo: form.get("assignedTo"), isPublic: form.get("isPublic") === "yes" });
      event.currentTarget.reset();
    } catch (cause) { setError((cause as Error).message); }
  }

  async function askAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await json("/api/evidence/v1/agent", { geoid: plan?.workspace.geoid, question: form.get("question"), workspaceId, sectionKey: form.get("sectionKey") });
      setNotice("The cited agent result is waiting for human review.");
      event.currentTarget.reset();
    } catch (cause) { setError((cause as Error).message); }
  }

  async function reviewSuggestion(id: string, decision: "accepted" | "rejected", sectionKey: string) {
    const section = plan?.sections.find((item) => item.sectionKey === sectionKey);
    try {
      await json(`/api/evidence/v1/workspaces/${workspaceId}/artifacts`, { action: "review_suggestion", suggestionId: id, decision, expectedSectionVersion: section?.version ?? 0 });
      setNotice(decision === "accepted" ? "Suggestion accepted into the versioned plan." : "Suggestion rejected and retained in history.");
    } catch (cause) { setError((cause as Error).message); }
  }

  async function addScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const assumptions = [{ key: "planning_note", value: String(form.get("assumption") || "Local review required"), owner: plan?.actor.principalId || "" }];
    try {
      await json(`/api/evidence/v1/workspaces/${workspaceId}/scenarios`, {
        name: form.get("name"), inputs: { hubLocations: [{ type: form.get("hubType"), count: Number(form.get("hubCount")) }], eventFrequencyPerYear: Number(form.get("events")) || null, verifiedPartnerCapacity: null, geographicReach: null, publicTransportationContext: null, digitalReadinessSupport: null, workforceAvailability: null, confirmedLocalPriorityIds: [], assumptions }, evidenceUsed: [], evidenceMissing: ["Verified partner capacity", "Locally reviewed delivery assumptions"],
      });
      event.currentTarget.reset();
    } catch (cause) { setError((cause as Error).message); }
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await json(`/api/evidence/v1/workspaces/${workspaceId}/invitations`, { role: form.get("role"), access: form.get("access"), intendedPrincipalId: form.get("recipient") });
      setInviteLink(`${window.location.origin}/explore/invitation?token=${encodeURIComponent(result.invitation.token)}`);
    } catch (cause) { setError((cause as Error).message); }
  }

  async function createShare() {
    try {
      const result = await json(`/api/evidence/v1/workspaces/${workspaceId}/share`, { scope: "read_only", expiresInHours: 72 });
      setShareLink(`${window.location.origin}/explore/share?token=${encodeURIComponent(result.share.token)}`);
      await loadOwnerControls(plan!);
    } catch (cause) { setError((cause as Error).message); }
  }

  async function revokeShare(shareId: string) {
    try {
      await json(`/api/evidence/v1/workspaces/${workspaceId}/share`, { shareId }, "DELETE");
      setShareLink("");
      await loadOwnerControls(plan!);
      setNotice("The public share link was revoked.");
    } catch (cause) { setError((cause as Error).message); }
  }

  if (!plan) return <main className={styles.shell}><p className={styles.state}>{error || "Loading the county workspace…"}</p><a className={styles.back} href="/explore/workspaces">Back to workspaces</a></main>;
  const membership = plan.participants.find((participant) => participant.principalId === plan.actor.principalId);
  const workspaceAccess = membership?.access ?? "viewer";
  const workspaceRole = membership?.role ?? "research_funder_viewer";
  const writable = workspaceAccess === "owner" || workspaceAccess === "contributor";
  const canAudit = workspaceAccess === "owner" || workspaceRole === "foundation_reviewer";
  const defaultSection: Section = { sectionKey: "plan", version: 0, content: { body: "" }, updatedAt: "" };

  return <main className={styles.shell}>
    <header className={styles.top}><a href="/explore/workspaces">← Workspaces</a><span>SozoRock Place Intelligence</span><form action="/api/evidence/v1/auth/logout" method="post"><button>Sign out</button></form></header>
    <section className={styles.workspaceHero}><p>{plan.workspace.geographyName} · GEOID {plan.workspace.geoid}</p><h1>{plan.workspace.title}</h1><div>{plan.participants.map((participant) => <span key={participant.principalId}>{participant.displayName} · {participant.role.replaceAll("_", " ")}</span>)}</div></section>
    {error && <p className={styles.workspaceAlert} role="alert">{error}</p>}{notice && <p className={styles.workspaceNotice} role="status">{notice}</p>}
    <nav className={styles.workspaceNav} aria-label="Workspace sections"><a href="#plan">Plan</a><a href="#agent">Agent suggestions</a><a href="#review">Review</a><a href="#scenarios">Scenarios</a><a href="#activity">Activity</a>{canAudit && <a href="#audit">Audit</a>}</nav>
    <div className={styles.workspaceGrid}>
      <section id="plan" className={styles.workspacePanel}><header><h2>Named plan sections</h2><span>Optimistic version checks protect concurrent edits.</span></header>{plan.sections.length ? plan.sections.map((section) => <SectionEditor key={section.sectionKey} section={section} writable={writable} onSave={saveSection} />) : writable ? <SectionEditor section={defaultSection} writable onSave={saveSection} /> : <p>No plan section has been started.</p>}</section>
      <section id="agent" className={styles.workspacePanel}><header><h2>Place Agent</h2><span>Suggestions stay outside the accepted plan until a human accepts them.</span></header>{writable && <form className={styles.stackForm} onSubmit={askAgent}><label>Plan section<select name="sectionKey">{(plan.sections.length ? plan.sections : [{ sectionKey: "plan" }]).map((section) => <option key={section.sectionKey}>{section.sectionKey}</option>)}</select></label><label>Grounded county question<textarea name="question" required minLength={3} /></label><button>Ask and create suggestion</button></form>}<div className={styles.suggestions}>{plan.suggestions.map((suggestion) => <article key={suggestion.id} data-status={suggestion.status}><strong>{suggestion.sectionKey} · {suggestion.status}</strong><pre>{JSON.stringify(suggestion.content, null, 2)}</pre>{suggestion.status === "pending" && writable ? <div><button onClick={() => void reviewSuggestion(suggestion.id, "accepted", suggestion.sectionKey)}>Accept into plan</button><button onClick={() => void reviewSuggestion(suggestion.id, "rejected", suggestion.sectionKey)}>Reject</button></div> : null}</article>)}</div></section>
      <section id="review" className={styles.workspacePanel}><header><h2>Comments and review questions</h2><span>Viewer accounts can observe but cannot write.</span></header>{writable && <div className={styles.formPair}><form className={styles.stackForm} onSubmit={(event) => void addArtifact(event, "comment")}><label>Section<input name="sectionKey" defaultValue="plan" /></label><label>Comment<textarea name="body" required /></label><button>Add comment</button></form><form className={styles.stackForm} onSubmit={(event) => void addArtifact(event, "review_question")}><label>Section<input name="sectionKey" defaultValue="plan" /></label><label>Question<textarea name="question" required /></label><label>Assign to<select name="assignedTo"><option value="">Unassigned</option>{plan.participants.filter((participant) => participant.principalId !== "sozorock-place-agent").map((participant) => <option value={participant.principalId} key={participant.principalId}>{participant.displayName}</option>)}</select></label><label><input type="checkbox" name="isPublic" value="yes" /> Public after resolution</label><button>Assign review question</button></form></div>}<ul>{plan.comments.map((comment) => <li key={comment.id}><strong>{comment.sectionKey}</strong> {comment.body}</li>)}{plan.reviewQuestions.map((question) => <li key={question.id}><strong>{question.status}</strong> {question.question}</li>)}</ul></section>
      <section id="scenarios" className={styles.workspacePanel}><header><h2>Scenario comparison</h2><span>Modeled planning assumptions are never observed outcomes.</span></header>{writable && <form className={styles.scenarioForm} onSubmit={addScenario}><label>Name<input name="name" required minLength={3} /></label><label>Hub format<select name="hubType"><option value="library">Library</option><option value="community">Community</option><option value="home">Home</option></select></label><label>Count<input name="hubCount" type="number" min="0" max="1000" defaultValue="1" /></label><label>Events/year<input name="events" type="number" min="0" max="365" defaultValue="1" /></label><label>Planning assumption<input name="assumption" /></label><button>Create versioned scenario</button></form>}<ScenarioTable scenarios={plan.scenarios} writable={writable} onReview={async (id, decision) => { try { await json(`/api/evidence/v1/workspaces/${workspaceId}/scenarios`, { scenarioId: id, decision }, "PATCH"); } catch (cause) { setError((cause as Error).message); } }} /></section>
      <section id="activity" className={styles.workspacePanel}><header><h2>Live activity and invitations</h2><span>Polling resumes from event sequence {lastSequence}; committed changes appear in both sessions.</span></header><p>Current version {plan.workspace.version}. Last updated {new Date(plan.workspace.updatedAt).toLocaleString()}.</p>{workspaceAccess === "owner" ? <><form className={styles.scenarioForm} onSubmit={invite}><label>Role<select name="role"><option value="county_planner">County planner</option><option value="community_partner">Community partner</option><option value="foundation_reviewer">Foundation reviewer</option><option value="research_funder_viewer">Research/funder viewer</option></select></label><label>Access<select name="access"><option value="contributor">Contributor</option><option value="viewer">Viewer</option></select></label><label>Recipient identity<input name="recipient" required /></label><button>Create expiring invitation</button></form>{inviteLink && <p><strong>Invitation link</strong><br /><input readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /></p>}<div className={styles.shareControls}><button onClick={() => void createShare()}>Create 72-hour public read-only link</button>{shareLink && <input aria-label="New public share link" readOnly value={shareLink} onFocus={(event) => event.currentTarget.select()} />}{shares.map((share) => <p key={share.id}>Read-only link expires {new Date(share.expiresAt).toLocaleString()}. <button onClick={() => void revokeShare(share.id)}>Revoke</button></p>)}</div></> : null}</section>
      {canAudit && <section id="audit" className={styles.workspacePanel}><header><h2>Compliance audit</h2><span>Authorized view. Public shares never include this history.</span></header><div className={styles.auditTable} role="table" aria-label="Workspace audit history"><div role="row"><span role="columnheader">Sequence</span><span role="columnheader">Action</span><span role="columnheader">Actor</span><span role="columnheader">Outcome</span><span role="columnheader">Time</span></div>{auditEvents.map((event) => <div role="row" key={event.sequenceNumber}><span role="cell">{event.sequenceNumber}</span><span role="cell">{event.eventType.replaceAll("_", " ")}</span><span role="cell">{event.actorType}</span><span role="cell">{event.outcome}</span><span role="cell">{new Date(event.occurredAt).toLocaleString()}</span></div>)}</div></section>}
    </div>
  </main>;
}

function SectionEditor({ section, writable, onSave }: { section: Section; writable: boolean; onSave: (section: Section, body: string) => Promise<void> }) {
  const [body, setBody] = useState(typeof section.content.body === "string" ? section.content.body : JSON.stringify(section.content, null, 2));
  useEffect(() => setBody(typeof section.content.body === "string" ? section.content.body : JSON.stringify(section.content, null, 2)), [section]);
  return <article className={styles.sectionEditor}><header><strong>{section.sectionKey}</strong><span>version {section.version}</span></header><textarea value={body} onChange={(event) => setBody(event.target.value)} readOnly={!writable} />{writable && <button onClick={() => void onSave(section, body)}>Save new version</button>}</article>;
}

function ScenarioTable({ scenarios, writable, onReview }: { scenarios: Scenario[]; writable: boolean; onReview: (id: string, decision: "verified" | "rejected") => Promise<void> }) {
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ contractVersion: "explore.scenario-comparison.v1", scenarios }, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "sozorock-scenario-comparison.json"; anchor.click(); URL.revokeObjectURL(url);
  }
  return <>{scenarios.length >= 2 ? <div className={styles.scenarioTable} role="table" aria-label="Scenario comparison"><div role="row"><span role="columnheader">Scenario</span><span role="columnheader">Version</span><span role="columnheader">Assumptions</span><span role="columnheader">Evidence gaps</span><span role="columnheader">Review</span></div>{scenarios.map((scenario) => <div role="row" key={scenario.id}><span role="cell">{scenario.name}</span><span role="cell">{scenario.version}</span><span role="cell">{JSON.stringify((scenario.output as { inputs?: unknown }).inputs ?? {})}</span><span role="cell">{((scenario.output as { evidenceMissing?: string[] }).evidenceMissing ?? []).join("; ") || "None stated"}</span><span role="cell">{scenario.humanReviewStatus}{writable && scenario.humanReviewStatus === "not_reviewed" ? <><button onClick={() => void onReview(scenario.id, "verified")}>Verify</button><button onClick={() => void onReview(scenario.id, "rejected")}>Reject</button></> : null}</span></div>)}</div> : <p>Create at least two scenarios to compare assumptions, evidence gaps and review state.</p>}{scenarios.length ? <button className={styles.downloadScenario} onClick={download}>Download machine-readable scenarios</button> : null}</>;
}
