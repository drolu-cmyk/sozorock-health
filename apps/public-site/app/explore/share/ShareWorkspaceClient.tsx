"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../explore.module.css";

type SharedPlan = {
  share: {
    scope: "read_only" | "contributor";
    expiresAt: string;
    title: string;
    geoid: string;
    geographyName: string;
  };
  plan: {
    workspace: { title: string; geoid: string; geographyName: string; updatedAt: string };
    sections: Array<{ sectionKey: string; version: number; content: Record<string, unknown>; updatedAt: string }>;
    reviewQuestions: Array<{ sectionKey: string; question: string; status: string }>;
    scenarios: Array<{ name: string; status: string; output: Record<string, unknown>; humanReviewStatus: string }>;
    citations: Array<{ citationId: string; publisher: string | null; sourceTitle: string | null; officialUrl: string; releaseDate: string | null; dataPeriod: { start: string | null; end: string | null } | null; geography: string | null; measureOrPassage: string | null; confidence: string | null; limitations: string[] }>;
  };
};

function readableContent(content: Record<string, unknown>) {
  const preferred = ["title", "summary", "body", "questions", "notes", "decision"];
  const ordered = [...preferred.filter((key) => key in content), ...Object.keys(content).filter((key) => !preferred.includes(key))];
  return ordered
    .map((key) => {
      const value = content[key];
      const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      return `${key}: ${text}`;
    })
    .join("\n");
}

function tokenFromLocation() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const fragmentToken = hashParams.get("token")?.trim() ?? (/^[A-Za-z0-9_-]{43}$/.test(hash) ? hash : "");
  const legacyQueryToken = new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
  return fragmentToken || legacyQueryToken;
}

function cleanAddressBar() {
  window.history.replaceState(null, "", window.location.pathname);
}

async function loadSharedPlan() {
  const response = await fetch("/api/evidence/v1/workspace-share", {
    cache: "no-store",
    credentials: "same-origin",
    referrerPolicy: "no-referrer",
  });
  const payload = await response.json() as SharedPlan & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "This shared workspace link is no longer available.");
  return payload;
}

export function ShareWorkspaceClient() {
  const [result, setResult] = useState<SharedPlan | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const token = tokenFromLocation();
        if (token) {
          cleanAddressBar();
          const claim = await fetch("/api/evidence/v1/workspace-share", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
            cache: "no-store",
            credentials: "same-origin",
            referrerPolicy: "no-referrer",
          });
          const claimPayload = await claim.json() as { error?: string };
          if (!claim.ok) throw new Error(claimPayload.error ?? "This shared workspace link is no longer available.");
        }
        const payload = await loadSharedPlan();
        if (!cancelled) {
          setResult(payload);
          setStatus("ready");
        }
      } catch (nextError) {
        if (!cancelled) {
          setError((nextError as Error).message);
          setStatus("error");
        }
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") return <main className={styles.workspace}><div className={styles.shareCard}><p>Loading the shared county plan…</p></div></main>;
  if (status === "error" || !result) return <main className={styles.workspace}><div className={styles.shareCard}><span>Shared plan</span><h1>This link is unavailable.</h1><p>{error}</p><Link className={styles.planReviewCta} href="/explore">Return to Place Intelligence</Link></div></main>;

  const { share, plan } = result;
  return (
    <main className={styles.workspace}>
      <header className={styles.workspaceToolbar}>
        <div><span>SozoRock Place Intelligence</span><h1>{share.title || plan.workspace.title}</h1><p>{share.geographyName} · County GEOID {share.geoid}</p></div>
        <div className={styles.workspaceActions}><Link href={`/explore?kind=county&geoid=${encodeURIComponent(share.geoid)}&view=brief`}>Open evidence brief</Link></div>
      </header>
      <div className={styles.shareCard}>
        <div className={styles.shareNotice}><strong>Read-only shared plan</strong><span>Expires {new Date(share.expiresAt).toLocaleString()}</span></div>
        <p className={styles.shareIntro}>This workspace contains planning material linked to the selected county evidence package. It does not contain resident records or clinical information.</p>
        <section aria-labelledby="shared-sections-title">
          <h2 id="shared-sections-title">Plan sections</h2>
          {plan.sections.length === 0 ? <p>No plan sections have been saved yet.</p> : (
            <div className={styles.shareSections}>{plan.sections.map((section) => <article key={section.sectionKey}><header><h3>{section.sectionKey.replaceAll("-", " ")}</h3><span>Version {section.version}</span></header><pre>{readableContent(section.content)}</pre></article>)}</div>
          )}
        </section>
        {plan.reviewQuestions.length > 0 && <section aria-labelledby="shared-questions-title"><h2 id="shared-questions-title">Review questions</h2><ul>{plan.reviewQuestions.map((question) => <li key={`${question.sectionKey}-${question.question}`}>{question.question} <span>({question.status})</span></li>)}</ul></section>}
        {plan.scenarios.length > 0 && <section aria-labelledby="shared-scenarios-title"><h2 id="shared-scenarios-title">Planning scenarios</h2><ul>{plan.scenarios.map((scenario) => <li key={scenario.name}>{scenario.name} · {scenario.humanReviewStatus}</li>)}</ul><p>Scenarios are planning ranges, not predictions.</p></section>}
        {plan.citations.length > 0 && <section aria-labelledby="shared-citations-title"><h2 id="shared-citations-title">Approved evidence citations</h2><ul>{plan.citations.map((citation) => <li key={citation.citationId}><a href={citation.officialUrl} rel="noreferrer">{citation.sourceTitle ?? citation.publisher ?? citation.citationId}</a>{citation.releaseDate ? ` · Released ${citation.releaseDate}` : ""}{citation.dataPeriod?.start || citation.dataPeriod?.end ? ` · Data ${citation.dataPeriod.start ?? "?"}–${citation.dataPeriod.end ?? "?"}` : ""}</li>)}</ul></section>}
      </div>
    </main>
  );
}
