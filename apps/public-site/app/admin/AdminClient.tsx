"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";

type PublicationOption = { slug: string; title: string };
type Actor = {
  displayName: string;
  username: string;
  access: "owner" | "contributor";
  mfaEnabled: boolean;
};
type ContactRecord = {
  createdAt: string;
  name: string;
  email: string;
  inquiryType: string;
  role: string;
  stateOrCounty: string;
  message: string;
};
type PublicationRequest = {
  requestId: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerifiedAt: string;
  organization: string;
  sector: string;
  state: string;
  country: string;
  qualityScore: number;
  qualityBand: string;
  source: string;
  updatesConsent: boolean;
};
type PublicationIntelligence = {
  publication: { slug: string; title: string };
  generatedAt: string;
  summary: {
    requests: number;
    verifiedEmails: number;
    unverifiedEmails: number;
    verificationRate: number;
    downloadLinksIssued: number;
    averageQualityScore: number;
  };
  requests: PublicationRequest[];
};

type SessionState = "loading" | "signed_out" | "password_change" | "mfa_challenge" | "mfa_enroll" | "signed_in";
type View = "contacts" | "publications";

class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function jsonRequest<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(
      typeof body.error === "string" ? body.error : "The request could not be completed.",
      response.status,
      body,
    );
  }
  return body as T;
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function AdminClient({ publications }: { publications: PublicationOption[] }) {
  const [session, setSession] = useState<SessionState>("loading");
  const [actor, setActor] = useState<Actor | null>(null);
  const [view, setView] = useState<View>("contacts");
  const [selectedPublication, setSelectedPublication] = useState(publications[0]?.slug ?? "");
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [intelligence, setIntelligence] = useState<PublicationIntelligence | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaUri, setMfaUri] = useState("");

  const expireSession = useCallback(() => {
    setActor(null);
    setSession("signed_out");
    setContacts([]);
    setIntelligence(null);
    setMfaSecret("");
    setMfaUri("");
  }, []);

  const refreshSession = useCallback(async () => {
    const current = await jsonRequest<{ authenticated: boolean; actor?: Actor }>("/api/admin/session");
    if (!current.authenticated || !current.actor) throw new Error("The administration session was not created.");
    setActor(current.actor);
    setSession(current.actor.mfaEnabled ? "signed_in" : "mfa_enroll");
    return current.actor;
  }, []);

  useEffect(() => {
    let active = true;
    refreshSession()
      .catch(() => { if (active) expireSession(); });
    return () => { active = false; };
  }, [expireSession, refreshSession]);

  useEffect(() => {
    if (session !== "mfa_enroll" || mfaSecret) return;
    let active = true;
    setBusy(true);
    setMessage("");
    jsonRequest<{ enrolled: boolean; secretCode?: string; otpauthUri?: string }>("/api/admin/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    })
      .then((result) => {
        if (!active) return;
        if (result.enrolled) {
          void refreshSession();
          return;
        }
        if (!result.secretCode || !result.otpauthUri) throw new Error("The authenticator setup key was not returned.");
        setMfaSecret(result.secretCode);
        setMfaUri(result.otpauthUri);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) expireSession();
        else setMessage(error instanceof Error ? error.message : "Authenticator setup could not start.");
      })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [session, mfaSecret, expireSession, refreshSession]);

  useEffect(() => {
    if (session !== "signed_in") return;
    let active = true;
    setDataBusy(true);
    jsonRequest<{ records: ContactRecord[] }>("/api/admin/contacts")
      .then((result) => { if (active) setContacts(result.records); })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) expireSession();
        else setMessage(error instanceof Error ? error.message : "Contact inquiries could not be loaded.");
      })
      .finally(() => { if (active) setDataBusy(false); });
    return () => { active = false; };
  }, [session, refreshKey, expireSession]);

  useEffect(() => {
    if (session !== "signed_in" || !selectedPublication) return;
    let active = true;
    setDataBusy(true);
    jsonRequest<{ intelligence: PublicationIntelligence }>(`/api/admin/publications/${encodeURIComponent(selectedPublication)}`)
      .then((result) => { if (active) setIntelligence(result.intelligence); })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) expireSession();
        else setMessage(error instanceof Error ? error.message : "Publication access could not be loaded.");
      })
      .finally(() => { if (active) setDataBusy(false); });
    return () => { active = false; };
  }, [session, selectedPublication, refreshKey, expireSession]);

  const filteredContacts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((record) => [record.name, record.email, record.inquiryType, record.role, record.stateOrCounty, record.message]
      .some((value) => value.toLowerCase().includes(term)));
  }, [contacts, query]);

  const filteredPublicationRequests = useMemo(() => {
    const rows = intelligence?.requests ?? [];
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((record) => [record.firstName, record.lastName, record.email, record.organization, record.sector, record.state, record.country, record.source]
      .some((value) => value.toLowerCase().includes(term)));
  }, [intelligence, query]);

  function setChallenge(error: unknown) {
    if (!(error instanceof ApiError) || error.status !== 409) return false;
    if (error.data.challenge === "NEW_PASSWORD_REQUIRED") {
      setSession("password_change");
      return true;
    }
    if (error.data.challenge === "SOFTWARE_TOKEN_MFA") {
      setSession("mfa_challenge");
      return true;
    }
    return false;
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await jsonRequest("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      await refreshSession();
    } catch (error) {
      if (!setChallenge(error)) setMessage(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function setInitialPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setMessage("The passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      await jsonRequest("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      await refreshSession();
    } catch (error) {
      if (!setChallenge(error)) setMessage(error instanceof Error ? error.message : "The password could not be set.");
    } finally {
      setBusy(false);
    }
  }

  async function submitMfaChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await jsonRequest("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaCode: form.get("mfaCode") }),
      });
      await refreshSession();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The authenticator code was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyMfaEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await jsonRequest("/api/admin/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: form.get("mfaCode") }),
      });
      await refreshSession();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The authenticator code was not accepted.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await jsonRequest("/api/admin/session", { method: "DELETE" });
    } catch {
      // A local reset still follows if the upstream session was already expired.
    } finally {
      setBusy(false);
      setMessage("");
      expireSession();
    }
  }

  if (session === "loading") {
    return <main className={styles.authShell}><p className={styles.loading}>Checking secure session…</p></main>;
  }

  if (session !== "signed_in") {
    return (
      <main className={styles.authShell}>
        <section className={styles.authPanel} aria-labelledby="admin-title">
          <a className={styles.brand} href="https://www.sozorockfoundation.org/">The SozoRock Foundation</a>
          <h1 id="admin-title">Foundation Operations</h1>
          <p>Private access for authorized Foundation reviewers.</p>

          {session === "signed_out" ? (
            <form onSubmit={signIn} className={styles.authForm}>
              <label>Email<input name="username" type="email" autoComplete="username" required /></label>
              <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
              <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            </form>
          ) : null}

          {session === "password_change" ? (
            <form onSubmit={setInitialPassword} className={styles.authForm}>
              <p className={styles.setupNote}>Set a permanent password to finish account activation.</p>
              <label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={14} required /></label>
              <label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={14} required /></label>
              <button type="submit" disabled={busy}>{busy ? "Saving…" : "Set password"}</button>
              <button type="button" className={styles.secondaryButton} onClick={() => void signOut()}>Start over</button>
            </form>
          ) : null}

          {session === "mfa_challenge" ? (
            <form onSubmit={submitMfaChallenge} className={styles.authForm}>
              <p className={styles.setupNote}>Enter the six-digit code from your authenticator app.</p>
              <label>Authenticator code<input name="mfaCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
              <button type="submit" disabled={busy}>{busy ? "Checking…" : "Continue"}</button>
              <button type="button" className={styles.secondaryButton} onClick={() => void signOut()}>Start over</button>
            </form>
          ) : null}

          {session === "mfa_enroll" ? (
            <form onSubmit={verifyMfaEnrollment} className={styles.authForm}>
              <p className={styles.setupNote}>Authenticator protection is required before Foundation records can be opened.</p>
              {mfaSecret ? (
                <>
                  <p>Add a time-based account in your authenticator app using this setup key:</p>
                  <p><code>{mfaSecret}</code></p>
                  {mfaUri ? <a href={mfaUri}>Open in authenticator app</a> : null}
                  <label>Six-digit code<input name="mfaCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
                  <button type="submit" disabled={busy}>{busy ? "Verifying…" : "Enable authenticator"}</button>
                </>
              ) : <p>{busy ? "Creating authenticator setup…" : "Authenticator setup is not available yet."}</p>}
              <button type="button" className={styles.secondaryButton} onClick={() => void signOut()}>Sign out</button>
            </form>
          ) : null}

          <p className={styles.status} role="status" aria-live="polite">{message}</p>
        </section>
      </main>
    );
  }

  const summary = intelligence?.summary;
  return (
    <main className={styles.console}>
      <header className={styles.header}>
        <div>
          <a className={styles.brand} href="https://www.sozorockfoundation.org/">The SozoRock Foundation</a>
          <h1>Foundation Operations</h1>
        </div>
        <div className={styles.account}>
          <span>{actor?.displayName}</span>
          <button type="button" onClick={signOut} disabled={busy}>Sign out</button>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Operations sections">
        <button type="button" className={view === "contacts" ? styles.activeTab : ""} onClick={() => { setView("contacts"); setQuery(""); }}>Inquiries <span>{contacts.length}</span></button>
        <button type="button" className={view === "publications" ? styles.activeTab : ""} onClick={() => { setView("publications"); setQuery(""); }}>Publication access <span>{summary?.requests ?? 0}</span></button>
      </nav>

      <section className={styles.toolbar} aria-label="Operations controls">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter current view" aria-label="Filter current view" />
        <button type="button" onClick={() => { setMessage(""); setRefreshKey((value) => value + 1); }} disabled={dataBusy}>{dataBusy ? "Refreshing…" : "Refresh"}</button>
      </section>

      {message ? <p className={styles.error} role="status">{message}</p> : null}

      {view === "contacts" ? (
        <section className={styles.section} aria-labelledby="contacts-title">
          <div className={styles.sectionHeading}>
            <div><h2 id="contacts-title">Inquiries</h2><p>Consented partner, funding and institutional requests received through Foundation and Health forms.</p></div>
            <a href="/api/admin/contacts?format=csv">Export CSV</a>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Received</th><th>Name</th><th>Inquiry</th><th>Role</th><th>Location</th><th>Message</th></tr></thead>
              <tbody>
                {filteredContacts.map((record) => (
                  <tr key={`${record.createdAt}-${record.email}`}>
                    <td>{formatDate(record.createdAt)}</td>
                    <td><strong>{record.name}</strong><a href={`mailto:${record.email}`}>{record.email}</a></td>
                    <td>{record.inquiryType || "—"}</td>
                    <td>{record.role}</td>
                    <td>{record.stateOrCounty}</td>
                    <td className={styles.messageCell}>{record.message}</td>
                  </tr>
                ))}
                {!filteredContacts.length ? <tr><td colSpan={6} className={styles.empty}>No inquiries match this view.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className={styles.section} aria-labelledby="publications-title">
          <div className={styles.sectionHeading}>
            <div><h2 id="publications-title">Publication access</h2><p>Email verification, access quality and issued download links for controlled Foundation publications.</p></div>
            {selectedPublication ? <a href={`/api/admin/publications/${encodeURIComponent(selectedPublication)}?format=csv`}>Export CSV</a> : null}
          </div>

          <label className={styles.publicationSelect}>Publication<select value={selectedPublication} onChange={(event) => { setSelectedPublication(event.target.value); setQuery(""); }}>
            {publications.map((publication) => <option key={publication.slug} value={publication.slug}>{publication.title}</option>)}
          </select></label>

          <div className={styles.metrics} aria-label="Publication access summary">
            <div><span>Requests</span><strong>{summary?.requests ?? 0}</strong></div>
            <div><span>Verified</span><strong>{summary?.verifiedEmails ?? 0}</strong></div>
            <div><span>Verification rate</span><strong>{summary ? `${summary.verificationRate}%` : "—"}</strong></div>
            <div><span>Links issued</span><strong>{summary?.downloadLinksIssued ?? 0}</strong></div>
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Requested</th><th>Person</th><th>Organization</th><th>Sector</th><th>Location</th><th>Verification</th><th>Quality</th><th>Source</th></tr></thead>
              <tbody>
                {filteredPublicationRequests.map((record) => (
                  <tr key={record.requestId}>
                    <td>{formatDate(record.createdAt)}</td>
                    <td><strong>{[record.firstName, record.lastName].filter(Boolean).join(" ")}</strong><a href={`mailto:${record.email}`}>{record.email}</a></td>
                    <td>{record.organization || "—"}</td>
                    <td>{record.sector || "—"}</td>
                    <td>{[record.state, record.country].filter(Boolean).join(", ") || "—"}</td>
                    <td>{record.emailVerifiedAt ? `Verified ${formatDate(record.emailVerifiedAt)}` : "Pending"}</td>
                    <td>{record.qualityBand || "—"}{Number.isFinite(record.qualityScore) ? ` · ${record.qualityScore}` : ""}</td>
                    <td>{record.source || "direct"}</td>
                  </tr>
                ))}
                {!filteredPublicationRequests.length ? <tr><td colSpan={8} className={styles.empty}>No publication requests match this view.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
