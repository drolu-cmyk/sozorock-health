"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "../publications/publications.module.css";

type State = "idle" | "sending" | "sent" | "error";

export function PublicationAccessForm({ slug, title }: { slug: string; title: string }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    const payload = { ...body, deliveryConsent: form.get("deliveryConsent") === "yes", updatesConsent: form.get("updatesConsent") === "yes" };
    try {
      const response = await fetch(`/api/publications/access/${encodeURIComponent(slug)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "We could not process this request.");
      setState("sent");
      setMessage(result.message ?? "Check your email for a verification link.");
      event.currentTarget.reset();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "We could not process this request.");
    }
  }

  if (state === "sent") return <section className={styles.confirmation} aria-labelledby="access-confirmation"><h2 id="access-confirmation">Check your email.</h2><p>{message}</p><p>The verification link expires in 30 minutes. If it does not arrive, check your spam folder or submit the form again.</p><Link href={`/publications/${slug}`}>Return to the publication</Link></section>;

  return <form className={styles.form} onSubmit={submit} noValidate aria-describedby="access-privacy access-status">
    <div className={styles.formIntro}><p>Publication access</p><h1>Request {title}</h1><p>Complete this short form. We will send a verification link to your email address. We do not ask for health or medical information.</p></div>
    <div className={styles.twoColumns}>
      <label>First name <input required autoComplete="given-name" name="firstName" /></label>
      <label>Last name <input required autoComplete="family-name" name="lastName" /></label>
    </div>
    <label>Email address <input required type="email" autoComplete="email" inputMode="email" name="email" /></label>
    <label>Organization <span>(optional)</span><input autoComplete="organization" name="organization" /></label>
    <label>Role or sector <select required name="sector" defaultValue=""><option value="" disabled>Select one</option><option>Community organization</option><option>County or state agency</option><option>Healthcare organization</option><option>University or research</option><option>Foundation or funder</option><option>Policymaker</option><option>Student</option><option>Individual or family</option><option>Other</option></select></label>
    <div className={styles.twoColumns}>
      <label>City or region <input required autoComplete="address-level2" name="cityOrRegion" /></label>
      <label>State <input required autoComplete="address-level1" name="state" /></label>
    </div>
    <label>Country <input required autoComplete="country-name" name="country" defaultValue="United States" /></label>
    <label>Reason for interest <textarea required name="reason" rows={4} maxLength={800} /></label>
    <div className={styles.honeypot} aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label className={styles.checkbox}><input required type="checkbox" name="deliveryConsent" value="yes" /><span>I agree that The SozoRock Foundation Inc. may email me the verification and access link for this publication.</span></label>
    <label className={styles.checkbox}><input type="checkbox" name="updatesConsent" value="yes" /><span>Optional: Send me future publication updates. This is not required for access.</span></label>
    <p id="access-privacy" className={styles.privacy}>We use this information to provide and understand publication access. Do not include health or medical information. See our <Link href="/privacy">privacy notice</Link>.</p>
    <button type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending verification…" : "Email my verification link"}</button>
    <p id="access-status" className={state === "error" ? styles.error : styles.status} role="status" aria-live="polite">{message}</p>
  </form>;
}

