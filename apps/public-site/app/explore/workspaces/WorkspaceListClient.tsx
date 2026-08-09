"use client";
import { FormEvent, useEffect, useState } from "react";
import styles from "./workspace.module.css";

type Workspace = { id: string; title: string; geoid: string; geographyName: string; updatedAt: string; role: string; access: string; version: number };
export function WorkspaceListClient() {
  const [items, setItems] = useState<Workspace[]>([]);
  const [actor, setActor] = useState<{ displayName: string; role: string; access: string } | null>(null);
  const [state, setState] = useState<"loading"|"ready"|"signed_out"|"error">("loading");
  useEffect(() => { void fetch("/api/evidence/v1/workspaces", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (response.status === 403) { setState("signed_out"); return; } if (!response.ok) throw new Error(body.error); setItems(body.workspaces); setActor(body.actor); setState("ready"); }).catch(() => setState("error")); }, []);
  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/evidence/v1/workspaces", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ geoid: form.get("geoid"), title: form.get("title") }) });
    const body = await response.json(); if (!response.ok) { setState("error"); return; }
    window.location.assign(`/explore/workspaces/${body.workspace.id}`);
  }
  const requestedGeoid = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("geoid") ?? "";
  return <main className={styles.shell}><header className={styles.top}><a href="/explore">← Explore</a><span>SozoRock Place Intelligence</span>{actor ? <form action="/api/evidence/v1/auth/logout" method="post"><button>Sign out</button></form> : null}</header><section className={styles.hero}><p>County workspace</p><h1>Plan together without losing the evidence trail.</h1><p>Human decisions, agent suggestions, source citations and scenario assumptions remain visibly separate and auditable.</p></section>{state === "loading" && <p className={styles.state}>Loading your workspaces…</p>}{state === "signed_out" && <section className={styles.auth}><h2>Sign in to a county workspace.</h2><p>Workspace access is limited to invited Foundation reviewers, county partners, community contributors and read-only research or funder viewers.</p><a href="/api/evidence/v1/auth/start?returnTo=/explore/workspaces">Sign in securely</a></section>}{state === "error" && <p className={styles.state} role="alert">County workspaces are temporarily unavailable.</p>}{state === "ready" && <section className={styles.list}><header><h2>Your workspaces</h2><span>{actor?.displayName} · {actor?.role.replaceAll("_", " ")}</span></header>{actor?.access === "owner" ? <form className={styles.createWorkspace} onSubmit={createWorkspace}><label>County GEOID<input name="geoid" pattern="[0-9]{5}" defaultValue={requestedGeoid} required /></label><label>Workspace title<input name="title" minLength={3} required /></label><button>Create workspace</button></form> : null}{items.length ? items.map((item) => <a key={item.id} href={`/explore/workspaces/${item.id}`}><div><strong>{item.title}</strong><span>{item.geographyName} · GEOID {item.geoid}</span></div><small>{item.access} · version {item.version}<br />Updated {new Date(item.updatedAt).toLocaleString()}</small></a>) : <p>No county workspace membership is active for this account.</p>}</section>}</main>;
}
