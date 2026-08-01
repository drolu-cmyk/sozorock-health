"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../explore.module.css";

type SharedPlan = {
  share: {
    workspaceId: string;
    scope: "read_only" | "contributor";
    expiresAt: string;
    title: string;
    geoid: string;
    geographyName: string;
  };
  plan: {
    workspace: { title: string; geoid: string; geographyName: string; updatedAt: string };
    sections: Array<{ sectionKey: string; version: number; content: Record<string, unknown>; updatedAt: string }>;
    comments: Array<{ sectionKey: string; body: string; createdAt: string }>;
    reviewQuestions: Array<{ sectionKey: string; question: string; status: string }>;
    suggestions: Array<{ sectionKey: string; content: Record<string, unknown>; status: string }>;
    scenarios: Array<{ name: string; status: string; output: Record<string, unknown>; humanReviewStatus: string }>;
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

export function ShareWorkspaceClient() {
  const [result, setResult] = useState<SharedPlan | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
  }, []);

  useEffect(() => {
    if (!token) {
      setError("This shared workspace link is incomplete.");
      setStatus("error");
      return;
    }
    let cancelled = false;
    void fetch(`/api/evidence/v1/workspace-share?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as SharedPlan & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "This shared workspace link is no longer available.");
        if (!cancelled) {
          setResult(payload);
          setStatus("ready");
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError((nextError as Error).message);
          setStatus("error");
        }
      });
    return () => { cancelled = true; };
  }, [token]);

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
      </div>
    </main>
  );
}
