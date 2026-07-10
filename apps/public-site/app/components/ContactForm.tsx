"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [state, setState] = useState<"idle"|"sending"|"sent"|"error">("idle");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = new FormData(event.currentTarget);
    const raw = Object.fromEntries(form.entries());
    const payload = { name: raw.name, email: raw.email, inquiryType: raw.interest, stateOrCounty: raw.state, role: raw.interest, message: raw.message, website: raw.website, consent: raw.consent === "yes" };
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setState(response.ok ? "sent" : "error");
      if (response.ok) event.currentTarget.reset();
    } catch { setState("error"); }
  }
  return <form className="partner-form" onSubmit={submit}>
    <div className="form-row"><label>Name<input required name="name" autoComplete="name"/></label><label>Work email<input required type="email" name="email" autoComplete="email"/></label></div>
    <div className="form-row"><label>I&rsquo;m interested as<select required name="interest" defaultValue=""><option value="" disabled>Select one</option><option>Resident or family</option><option>Licensed provider</option><option>County or public agency</option><option>Library or community hub</option><option>Research, funding, or media</option></select></label><label>State<input required name="state" placeholder="e.g. New York" autoComplete="address-level1"/></label></div>
    <label>What would you like to build?<textarea required name="message" rows={4}/></label>
    <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"/>
    <label className="consent"><input required type="checkbox" name="consent" value="yes"/>I agree that The SozoRock Foundation, Inc. may use this information to respond to my inquiry. Do not include medical details.</label>
    <button disabled={state === "sending"} type="submit">{state === "sending" ? "Sending…" : "Start a conversation"}</button>
    <p className={`form-status ${state}`} role="status">{state === "sent" ? "Thank you. Your inquiry has been received." : state === "error" ? "We could not send this right now. Please email contact@sozorockfoundation.org." : "Protected by validation, rate limiting, and consent controls."}</p>
  </form>;
}
