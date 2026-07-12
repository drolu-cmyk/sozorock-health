"use client";

import { FormEvent, useState } from "react";

const volunteerAreas = ["Community outreach", "Research support", "Health education support", "Digital navigation", "Event support", "Communications", "Data and evaluation", "Technology and cybersecurity", "Professional advisory interest", "Clinical advisory interest", "Other"];

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [interest, setInterest] = useState("");
  const [message, setMessage] = useState("Please do not include medical, emergency, or protected health information.");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const raw = Object.fromEntries(form.entries());
    const volunteerArea = typeof raw.volunteerArea === "string" ? raw.volunteerArea : "";
    const inquiryMessage = `${volunteerArea ? `Volunteer area: ${volunteerArea}\n` : ""}${String(raw.message ?? "")}`;
    const payload = { name: raw.name, email: raw.email, inquiryType: raw.interest, stateOrCounty: raw.location, role: raw.organizationType, message: inquiryMessage, website: raw.website, consent: raw.consent === "yes" };
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (response.ok) {
        setState("sent");
        setMessage(result.message ?? "Thank you. Your inquiry has been received.");
        formElement.reset();
        setInterest("");
      } else {
        setState("error");
        setMessage(result.error ?? "We could not send this right now. Please try again.");
      }
    } catch {
      setState("error");
      setMessage("We could not send this right now. Email contact@sozorockfoundation.org if the problem continues.");
    }
  }

  return (
    <form className="partner-form" onSubmit={submit} aria-describedby="contact-guidance contact-status" noValidate>
      <p id="contact-guidance">Fields marked required must be completed.</p>
      <div className="form-row">
        <label>Full name <span aria-hidden="true">*</span><input required name="name" autoComplete="name" /></label>
        <label>Email <span aria-hidden="true">*</span><input required type="email" name="email" autoComplete="email" /></label>
      </div>
      <div className="form-row">
        <label>What would you like to do? <span aria-hidden="true">*</span><select required name="interest" value={interest} onChange={(event) => setInterest(event.target.value)}><option value="" disabled>Select one</option><option>Partner with us</option><option>Fund the work</option><option>Volunteer</option><option>Support research and publications</option><option>Bring the model to a community</option><option>Institutional or public-sector inquiry</option></select></label>
        <label>Organization or role <span aria-hidden="true">*</span><select required name="organizationType" defaultValue=""><option value="" disabled>Select one</option><option>Individual or family</option><option>Community organization</option><option>Licensed provider or health organization</option><option>County, state, or public agency</option><option>University or researcher</option><option>Foundation or funder</option><option>Corporate organization</option><option>Other</option></select></label>
      </div>
      {interest === "Volunteer" && <label>Volunteer interest <span aria-hidden="true">*</span><select required name="volunteerArea" defaultValue=""><option value="" disabled>Select one</option>{volunteerAreas.map((area) => <option key={area}>{area}</option>)}</select></label>}
      <label>City, state, or region <span aria-hidden="true">*</span><input required name="location" autoComplete="address-level1" /></label>
      <label>What outcome are you working toward? <span aria-hidden="true">*</span><textarea required name="message" rows={5} /></label>
      <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="consent"><input required type="checkbox" name="consent" value="yes" /><span>I agree that The SozoRock Foundation Inc. may use this information to respond to my inquiry. I have read the <a href="/privacy">Privacy Notice</a>.</span></label>
      <button disabled={state === "sending"} type="submit">{state === "sending" ? "Sending…" : "Send inquiry"}</button>
      <p id="contact-status" className={`form-status ${state}`} role="status" aria-live="polite">{message}</p>
    </form>
  );
}
