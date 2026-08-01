"use client";

import { FormEvent, useState } from "react";
import styles from "../explore.module.css";

const roleOptions = [
  ["county", "County or public agency"],
  ["provider", "Licensed provider or health organization"],
  ["library", "Library"],
  ["community_host", "Community host"],
  ["education_workforce", "Education or workforce partner"],
  ["funder", "Foundation or funder"],
  ["research", "University or researcher"],
] as const;

export function OnboardingClient() {
  const params = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [countyGeoid, setCountyGeoid] = useState(params?.get("geoid") ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/evidence/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countyGeoid: String(form.get("countyGeoid") ?? ""),
          organization: String(form.get("organization") ?? ""),
          contactName: String(form.get("contactName") ?? ""),
          email: String(form.get("email") ?? ""),
          role: String(form.get("role") ?? ""),
          intendedUse: String(form.get("intendedUse") ?? ""),
          consent: form.get("consent") === "on",
          source: "explore",
          environment: "production",
        }),
      });
      const payload = await response.json().catch(() => ({})) as { request?: { id?: string }; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The request could not be submitted.");
      setStatus("sent");
      setMessage("Your request is ready for review. We will follow up using the organizational contact you provided.");
      event.currentTarget.reset();
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message);
    }
  }

  return (
    <main className={styles.page}>
      <a className={styles.skip} href="#onboarding-form">Skip to request form</a>
      <header className={styles.header}>
        <a href="/explore" aria-label="Back to SozoRock Place Intelligence">SozoRock Place Intelligence</a>
        <nav aria-label="Explore onboarding navigation"><a href="/explore">Back to Explore</a></nav>
      </header>
      <section className={styles.hero} aria-labelledby="onboarding-title">
        <div className={styles.heroContent}>
          <span>PLACE INTELLIGENCE</span>
          <h1 id="onboarding-title">Request a county planning workspace.</h1>
          <p>Tell us how your organization would use the evidence. A Foundation reviewer will confirm the place, scope and next step before any workspace is activated.</p>
        </div>
      </section>
      <section className={styles.viewPanel} aria-labelledby="onboarding-form-title">
        <div className={styles.actionHeader}>
          <div><span>PARTNER ONBOARDING</span><h2 id="onboarding-form-title">Start with the place and the purpose.</h2></div>
          <p>This request is for non-clinical planning and evidence review. Do not submit medical information, patient records or protected health information.</p>
        </div>
        <form id="onboarding-form" className={styles.agentQuestion} onSubmit={submit} noValidate>
          <div className={styles.formGrid}>
            <label>County GEOID<input name="countyGeoid" value={countyGeoid} onChange={(event) => setCountyGeoid(event.target.value)} inputMode="numeric" pattern="[0-9]{5}" required placeholder="Example: 36001" /></label>
            <label>Organization<input name="organization" autoComplete="organization" required /></label>
            <label>Contact name<input name="contactName" autoComplete="name" required /></label>
            <label>Organizational email<input name="email" type="email" autoComplete="email" required /></label>
            <label>Role<select name="role" defaultValue="" required><option value="" disabled>Select one</option>{roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label>How would you use the place evidence?<textarea name="intendedUse" rows={5} minLength={10} maxLength={1000} required placeholder="Describe the planning, partnership or evidence-review purpose." /></label>
          <label className={styles.consentLine}><input type="checkbox" name="consent" required /> I consent to SozoRock Health using this information to review and follow up on the request. See the <a href="/privacy">Privacy Notice</a>.</label>
          <button type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending request…" : "Request review"}</button>
          {message && <p role={status === "error" ? "alert" : "status"}>{message}</p>}
        </form>
      </section>
    </main>
  );
}
