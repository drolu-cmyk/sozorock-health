"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  NEW_YORK_COUNTIES,
  PROGRAM_INTEREST_SUCCESS,
  validateProgramInterest,
  type ProgramInterestErrors,
} from "../lib/program-interest";

export function ProgramInterestForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errors, setErrors] = useState<ProgramInterestErrors>({});
  const [message, setMessage] = useState("");
  const sending = useRef(false);
  const status = useRef<HTMLParagraphElement>(null);
  const focusAfterRender = useRef<HTMLElement | null>(null);
  useEffect(() => {
    focusAfterRender.current?.focus();
    focusAfterRender.current = null;
  }, [errors, message, state]);

  function fieldError(name: keyof ProgramInterestErrors) {
    return errors[name] ? <span className="field-error" id={"interest-" + name + "-error"}>{errors[name]}</span> : null;
  }
  function fieldProps(name: keyof ProgramInterestErrors) {
    return {
      id: "interest-" + name,
      name,
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": errors[name] ? "interest-" + name + "-error" : undefined,
    };
  }
  function showErrors(form: HTMLFormElement, nextErrors: ProgramInterestErrors, summary: string) {
    setErrors(nextErrors);
    setState("error");
    setMessage(summary);
    const control = Array.from(form.elements).find((element) =>
      element instanceof HTMLElement && element.getAttribute("name") &&
      nextErrors[element.getAttribute("name") as keyof ProgramInterestErrors],
    );
    focusAfterRender.current = control instanceof HTMLElement ? control : status.current;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || state === "sent") return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = {
      inquiryType: "program-interest",
      firstName: String(values.get("firstName") ?? ""),
      lastName: String(values.get("lastName") ?? ""),
      email: String(values.get("email") ?? ""),
      phone: String(values.get("phone") ?? ""),
      preferredContact: String(values.get("preferredContact") ?? ""),
      county: String(values.get("county") ?? ""),
      heardAbout: String(values.get("heardAbout") ?? ""),
      website: String(values.get("website") ?? ""),
      newYorkResident: values.get("newYorkResident") === "yes",
      ageConfirmed: values.get("ageConfirmed") === "yes",
      consent: values.get("consent") === "yes",
    };
    const validation = validateProgramInterest(payload);
    if (!validation.ok) {
      showErrors(form, validation.errors, "Review the highlighted fields and try again.");
      return;
    }
    sending.current = true;
    setErrors({});
    setState("sending");
    setMessage("Sending your interest list request.");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as {
        accepted?: boolean; error?: string; errors?: ProgramInterestErrors;
      };
      if (response.ok && result.accepted === true) {
        setState("sent");
        setMessage(PROGRAM_INTEREST_SUCCESS);
        form.reset();
        focusAfterRender.current = status.current;
      } else {
        showErrors(form, result.errors ?? {}, result.error ?? "We could not save your request. Please try again.");
      }
    } catch {
      showErrors(form, {}, "We could not save your request. Please try again. If the problem continues, contact contact@sozorockfoundation.org.");
    } finally {
      sending.current = false;
    }
  }

  return (
    <form className="partner-form program-interest-form" onSubmit={submit} noValidate aria-describedby="interest-guidance interest-status" aria-busy={state === "sending"}>
      <p id="interest-guidance">Fields marked required must be completed. Provide at least one way to reach you.</p>
      <div className="form-row">
        <label htmlFor="interest-firstName">First name (required)<input {...fieldProps("firstName")} required maxLength={80} autoComplete="given-name" />{fieldError("firstName")}</label>
        <label htmlFor="interest-lastName">Last name (required)<input {...fieldProps("lastName")} required maxLength={80} autoComplete="family-name" />{fieldError("lastName")}</label>
      </div>
      <div className="form-row">
        <label htmlFor="interest-email">Email (email or phone required)<input {...fieldProps("email")} type="email" maxLength={254} autoComplete="email" />{fieldError("email")}</label>
        <label htmlFor="interest-phone">Phone (phone or email required)<input {...fieldProps("phone")} type="tel" maxLength={40} autoComplete="tel" />{fieldError("phone")}</label>
      </div>
      <label htmlFor="interest-preferredContact">Preferred contact method (required)
        <select {...fieldProps("preferredContact")} required defaultValue="">
          <option value="" disabled>Select one</option><option value="email">Email</option><option value="phone">Phone call</option><option value="text">Text</option>
        </select>{fieldError("preferredContact")}
      </label>
      <label htmlFor="interest-county">New York county (required)
        <select {...fieldProps("county")} required defaultValue="">
          <option value="" disabled>Select your county</option>
          {NEW_YORK_COUNTIES.map((county) => <option value={county} key={county}>{county}</option>)}
        </select>{fieldError("county")}
      </label>
      <label className="check-field" htmlFor="interest-newYorkResident">
        <input {...fieldProps("newYorkResident")} type="checkbox" required value="yes" />
        <span>I live in New York State (required){fieldError("newYorkResident")}</span>
      </label>
      <label className="check-field" htmlFor="interest-ageConfirmed">
        <input {...fieldProps("ageConfirmed")} type="checkbox" required value="yes" />
        <span>I am 64 or younger (required){fieldError("ageConfirmed")}</span>
      </label>
      <label htmlFor="interest-heardAbout">How did you hear about us? (optional, 200 characters maximum)
        <input {...fieldProps("heardAbout")} maxLength={200} />{fieldError("heardAbout")}
      </label>
      <input className="honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="check-field" htmlFor="interest-consent">
        <input {...fieldProps("consent")} type="checkbox" required value="yes" />
        <span>SozoRock may contact me about the Primary Care Access Program. I understand this does not enroll me. (required){fieldError("consent")}</span>
      </label>
      <p className="form-note">Please do not include medical, insurance, income or other personal health details. Eligibility is reviewed privately later.</p>
      <button type="submit" disabled={state === "sending" || state === "sent"}>{state === "sending" ? "Sending..." : state === "sent" ? "Request received" : "Join the interest list"}</button>
      <p ref={status} id="interest-status" className={"form-status " + state} role={state === "error" ? "alert" : "status"} aria-live={state === "error" ? "assertive" : "polite"} tabIndex={-1}>{message}</p>
    </form>
  );
}
