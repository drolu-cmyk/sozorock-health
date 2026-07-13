"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import styles from "../publications/publications.module.css";

type State = "idle" | "sending" | "sent" | "error";
type FieldName =
  | "firstName"
  | "lastName"
  | "email"
  | "sector"
  | "cityOrRegion"
  | "state"
  | "country"
  | "reason"
  | "deliveryConsent";
type Errors = Partial<Record<FieldName, string>>;

function validate(form: FormData): Errors {
  const value = (name: FieldName) => String(form.get(name) ?? "").trim();
  const errors: Errors = {};
  if (!value("firstName")) errors.firstName = "Enter your first name.";
  if (!value("lastName")) errors.lastName = "Enter your last name.";
  if (!value("email")) errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("email")))
    errors.email = "Enter a valid email address.";
  if (!value("sector")) errors.sector = "Choose a role or sector.";
  if (!value("cityOrRegion")) errors.cityOrRegion = "Enter your city or region.";
  if (!value("state")) errors.state = "Enter your state or province.";
  if (!value("country")) errors.country = "Enter your country.";
  if (!value("reason")) errors.reason = "Tell us why the publication is useful to you.";
  if (form.get("deliveryConsent") !== "yes")
    errors.deliveryConsent = "Confirm that we may email your access link.";
  return errors;
}

export function PublicationAccessForm({ slug, title }: { slug: string; title: string }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const clearError = (name: string) => {
    if (!(name in errors)) return;
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const fieldError = (name: FieldName) =>
    errors[name] ? (
      <span className={styles.fieldError} id={`publication-${name}-error`} role="alert">
        {errors[name]}
      </span>
    ) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setState("error");
      setMessage("Review the highlighted fields and try again.");
      const first = Object.keys(nextErrors)[0] as FieldName;
      const control = formElement.elements.namedItem(first);
      if (control instanceof HTMLElement) control.focus();
      return;
    }

    setErrors({});
    setState("sending");
    setMessage("");
    const body = Object.fromEntries(form.entries());
    const payload = {
      ...body,
      deliveryConsent: form.get("deliveryConsent") === "yes",
      updatesConsent: form.get("updatesConsent") === "yes",
    };
    try {
      const response = await fetch(
        `/api/publications/access/${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "We could not process this request.");
      setState("sent");
      setMessage(result.message ?? "Check your email for a verification link.");
      formElement.reset();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not process this request.",
      );
    }
  }

  if (state === "sent")
    return (
      <section className={styles.confirmation} aria-labelledby="access-confirmation">
        <h2 id="access-confirmation">Check your email.</h2>
        <p>{message}</p>
        <p>
          The verification link expires in 30 minutes. If it does not arrive,
          check your spam folder or submit the form again.
        </p>
        <Link href={`/publications/${slug}`}>Return to the publication</Link>
      </section>
    );

  return (
    <form
      className={styles.form}
      onSubmit={submit}
      onInput={(event) => clearError((event.target as HTMLInputElement).name)}
      noValidate
      aria-describedby="access-privacy access-status"
    >
      <div className={styles.formIntro}>
        <p>Publication access</p>
        <h1>Request {title}</h1>
        <p>
          Complete this short form. We will send a verification link to your
          email address. We do not ask for health or medical information.
        </p>
      </div>
      <div className={styles.twoColumns}>
        <label htmlFor="publication-first-name">
          First name
          <input id="publication-first-name" required autoComplete="given-name" name="firstName" aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? "publication-firstName-error" : undefined} />
          {fieldError("firstName")}
        </label>
        <label htmlFor="publication-last-name">
          Last name
          <input id="publication-last-name" required autoComplete="family-name" name="lastName" aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? "publication-lastName-error" : undefined} />
          {fieldError("lastName")}
        </label>
      </div>
      <label htmlFor="publication-email">
        Email address
        <input id="publication-email" required type="email" autoComplete="email" inputMode="email" name="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "publication-email-error" : undefined} />
        {fieldError("email")}
      </label>
      <label htmlFor="publication-organization">
        Organization <span>(optional)</span>
        <input id="publication-organization" autoComplete="organization" name="organization" />
      </label>
      <label htmlFor="publication-sector">
        Role or sector
        <select id="publication-sector" required name="sector" defaultValue="" aria-invalid={Boolean(errors.sector)} aria-describedby={errors.sector ? "publication-sector-error" : undefined}>
          <option value="" disabled>Select one</option>
          <option>Community organization</option>
          <option>County or state agency</option>
          <option>Healthcare organization</option>
          <option>University or research</option>
          <option>Foundation or funder</option>
          <option>Policymaker</option>
          <option>Student</option>
          <option>Individual or family</option>
          <option>Other</option>
        </select>
        {fieldError("sector")}
      </label>
      <div className={styles.twoColumns}>
        <label htmlFor="publication-city">
          City or region
          <input id="publication-city" required autoComplete="address-level2" name="cityOrRegion" aria-invalid={Boolean(errors.cityOrRegion)} aria-describedby={errors.cityOrRegion ? "publication-cityOrRegion-error" : undefined} />
          {fieldError("cityOrRegion")}
        </label>
        <label htmlFor="publication-state">
          State
          <input id="publication-state" required autoComplete="address-level1" name="state" aria-invalid={Boolean(errors.state)} aria-describedby={errors.state ? "publication-state-error" : undefined} />
          {fieldError("state")}
        </label>
      </div>
      <label htmlFor="publication-country">
        Country
        <input id="publication-country" required autoComplete="country-name" name="country" defaultValue="United States" aria-invalid={Boolean(errors.country)} aria-describedby={errors.country ? "publication-country-error" : undefined} />
        {fieldError("country")}
      </label>
      <label htmlFor="publication-reason">
        Reason for interest
        <textarea id="publication-reason" required name="reason" rows={4} maxLength={800} aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? "publication-reason-error" : undefined} />
        {fieldError("reason")}
      </label>
      <div className={styles.honeypot} aria-hidden="true">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className={styles.checkbox} htmlFor="publication-delivery-consent">
        <input id="publication-delivery-consent" required type="checkbox" name="deliveryConsent" value="yes" aria-invalid={Boolean(errors.deliveryConsent)} aria-describedby={errors.deliveryConsent ? "publication-deliveryConsent-error" : undefined} />
        <span>
          I agree that The SozoRock Foundation, Inc. may email me the verification
          and access link for this publication.
          {fieldError("deliveryConsent")}
        </span>
      </label>
      <label className={styles.checkbox} htmlFor="publication-updates-consent">
        <input id="publication-updates-consent" type="checkbox" name="updatesConsent" value="yes" />
        <span>
          Optional: Send me future publication updates. This is not required for
          access.
        </span>
      </label>
      <p id="access-privacy" className={styles.privacy}>
        We use this information to provide and understand publication access. Do
        not include health or medical information. See our <Link href="/privacy">privacy notice</Link>.
      </p>
      <button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending verification…" : "Email my verification link"}
      </button>
      <p id="access-status" className={state === "error" ? styles.error : styles.status} role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
