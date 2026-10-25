"use client";

import { useRef, useState } from "react";

const MESSAGE_LIMIT = 2000;

export const AUDIENCES = [
  { key: "residents", who: "Residents", what: "Join the interest list for a sponsored year of primary care.", cta: "Join the interest list", href: "/interest" },
  { key: "providers", who: "Providers", what: "Reach patients who struggle to get to you.", cta: "Tell us about your practice", title: "Tell us about your practice.", lead: "Residents use your own platform, so records, consent and medical decisions stay with you.", prompt: "Your practice, where you serve and how you would like to work together" },
  { key: "counties", who: "Counties and public agencies", what: "Use local data in your community health plan, or request a Health Access Day.", cta: "Plan with us", title: "Plan with us.", lead: "Tell us about your county’s health priorities. We share only non-identifying, aggregate data.", prompt: "Your county or agency, your health priorities and what you need" },
  { key: "funders", who: "Funders", what: "Support access where need is highest, with reports you can use.", cta: "Fund the work", title: "Fund the work.", lead: "Tell us what you fund and where. We will share the program budget, timeline and reporting schedule.", prompt: "Your focus areas, regions and timing" },
  { key: "media", who: "Media and research", what: "Interviews, data questions and research requests.", cta: "Ask a question", title: "Ask a question.", lead: "Interviews, data questions, citations and research collaboration.", prompt: "Your outlet or institution, your question and your deadline" },
];

/** @param {{initialAudience?: string, initialLocation?: string}} props */
export function AudienceContact({ initialAudience = "", initialLocation = "" }) {
  const start = AUDIENCES.find((a) => a.key === initialAudience && a.title) ?? AUDIENCES[1];
  const [audience, setAudience] = useState(start.key);
  const [state, setState] = useState("idle");
  const [note, setNote] = useState("Please leave out medical, insurance or urgent health information.");
  const formRef = useRef(null);
  const current = AUDIENCES.find((a) => a.key === audience) ?? AUDIENCES[1];

  function choose(key) {
    setAudience(key);
    setState("idle");
    requestAnimationFrame(() => formRef.current?.querySelector("input")?.focus());
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = new FormData(form);
    const text = (k) => String(data.get(k) ?? "").trim();
    const organization = text("organization");
    const message = `${organization ? `Organization: ${organization}\n\n` : ""}${text("message")}`.slice(0, MESSAGE_LIMIT);
    setState("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${text("firstName")} ${text("lastName")}`.trim(),
          email: text("email"),
          inquiryType: current.who,
          role: current.who,
          stateOrCounty: text("location"),
          message,
          website: text("website"),
          consent: data.get("consent") === "yes",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        setState("sent");
        setNote(result.message ?? "Thank you. We received your message and will reply by email.");
        form.reset();
      } else {
        setState("error");
        setNote(result.error ?? "We could not send this right now. Please try again.");
      }
    } catch {
      setState("error");
      setNote("We could not send this right now. Email contact@sozorockfoundation.org if the problem continues.");
    }
  }

  return <>
    <section className="hx-who-grid hx-wrap" aria-label="Choose who you are">
      <ul>
        {AUDIENCES.map((a) => {
          const active = a.key === audience;
          const inner = <><span className="hx-who-name">{a.who}</span><span className="hx-who-what">{a.what}</span><span className="hx-who-cta">{a.cta}</span></>;
          return <li key={a.key}>{a.href
            ? <a className="hx-who-card" href={a.href}>{inner}</a>
            : <button type="button" className={`hx-who-card${active ? " is-active" : ""}`} aria-pressed={active} aria-controls="contact-form" onClick={() => choose(a.key)}>{inner}</button>}</li>;
        })}
      </ul>
      <p className="hx-src">Residents go straight to the interest list. Everyone else continues to the short form below.</p>
    </section>

    <section className="hx-form-band hx-wrap hx-ice" id="contact-form" aria-labelledby="hx-form-title">
      <div className="hx-form-intro">
        <p className="hx-label">{current.who}</p>
        <h2 id="hx-form-title">{current.title}</h2>
        <p className="hx-answer">{current.lead}</p>
        <p className="hx-src">Prefer email? <a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a></p>
      </div>
      <form ref={formRef} className="hx-form" onSubmit={submit} noValidate={false}>
        <label>First name<input name="firstName" autoComplete="given-name" required maxLength={80} /></label>
        <label>Last name<input name="lastName" autoComplete="family-name" required maxLength={80} /></label>
        <label className="wide">Email<input name="email" type="email" autoComplete="email" required maxLength={160} /></label>
        <label><span>Organization <span className="opt">(optional)</span></span><input name="organization" autoComplete="organization" maxLength={160} /></label>
        <label>City and state<input name="location" autoComplete="address-level2" required maxLength={120} defaultValue={initialLocation} /></label>
        <label className="wide">How can we help?<textarea name="message" required rows={5} maxLength={1800} placeholder={current.prompt} /></label>
        <input className="hx-honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <label className="wide hx-consent"><input type="checkbox" name="consent" value="yes" required /><span>The SozoRock Foundation, Inc. may use this information to reply. I have read the <a href="/privacy">Privacy Notice</a>.</span></label>
        <div className="wide hx-form-send"><button type="submit" className="hx-pill" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send"}</button><p role="status" aria-live="polite" className={state === "error" ? "is-error" : ""}>{note}</p></div>
      </form>
    </section>
  </>;
}
