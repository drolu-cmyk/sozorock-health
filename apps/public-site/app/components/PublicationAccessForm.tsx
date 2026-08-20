"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  MIN_PUBLICATION_REASON_LENGTH,
  PUBLICATION_SECTORS,
} from "../lib/publication-validation";
import styles from "../publications/publications.module.css";

type State = "idle" | "sending" | "sent" | "error";
type FieldName =
  | "firstName"
  | "lastName"
  | "email"
  | "organization"
  | "sector"
  | "cityOrRegion"
  | "state"
  | "country"
  | "reason"
  | "deliveryConsent";
type Errors = Partial<Record<FieldName, string>>;

type AccessResponse = {
  accepted?: boolean;
  accessGranted?: boolean;
  verificationSent?: boolean;
  downloadUrl?: string;
  message?: string;
  error?: string;
};

function validate(form: FormData): Errors {
  const value = (name: FieldName) => String(form.get(name) ?? "").trim();
  const errors: Errors = {};
  if (!value("firstName")) errors.firstName = "Enter your first name.";
  if (!value("lastName")) errors.lastName = "Enter your last name.";
  if (!value("email")) errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("email")))
    errors.email = "Enter a valid email address.";
  if (!value("organization")) errors.organization = "Enter your organization or affiliation.";
  if (!value("sector")) errors.sector = "Choose a role or sector.";
  if (!value("cityOrRegion")) errors.cityOrRegion = "Enter your city or region.";
  if (!value("country")) errors.country = "Enter your country.";
  const country = value("country").toLowerCase();
  const regionName = ["united states", "united states of america", "us", "usa"].includes(country)
    ? "state or territory"
    : "state, province, or region";
  if (!value("state")) errors.state = `Enter your ${regionName}.`;
  if (!value("reason")) errors.reason = "Tell us why the publication is useful to you.";
  else if (value("reason").length < MIN_PUBLICATION_REASON_LENGTH)
    errors.reason = `Use at least ${MIN_PUBLICATION_REASON_LENGTH} characters.`;
  if (form.get("deliveryConsent") !== "yes")
    errors.deliveryConsent = "Confirm that we may use your email for publication access.";
  return errors;
}

export function PublicationAccessForm({ slug, title }: { slug: string; title: string }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [country, setCountry] = useState("United States");
  const isUnitedStates = ["united states", "united states of america", "us", "usa"].includes(
    country.trim().toLowerCase(),
  );
  const regionLabel = isUnitedStates
    ? "State or territory"
    : "State, province, or region";

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
    setDownloadUrl("");
    setVerificationSent(false);
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
      const result = (await response.json()) as AccessResponse;
      if (!response.ok)
        throw new Error(result.error ?? "We could not process this request.");
      if (!result.accessGranted || !result.downloadUrl)
        throw new Error("Secure publication access was not established. Please try again.");
      setState("sent");
      setMessage(result.message ?? "Your publication is ready to download.");
      setDownloadUrl(result.downloadUrl);
      setVerificationSent(result.verificationSent === true);
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
        <h2 id="access-confirmation">Your publication is ready.</h2>
        <p>{message}</p>
        <a className={styles.primary} href={downloadUrl}>
          Download publication
        </a>
        <p>
          {verificationSent
            ? "We also sent an optional email verification link. It expires in 30 minutes, but you do not need to wait for it to download the publication."
            : "You do not need to wait for an email. Your secure access is active in this browser."}
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
          Complete this short form to receive secure access. We will also try to
          send an optional email verification link. We do not ask for health or
          medical information.
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
        Organization or affiliation
        <input id="publication-organization" required autoComplete="organization" name="organization" aria-invalid={Boolean(errors.organization)} aria-describedby={errors.organization ? "publication-organization-error" : undefined} />
        {fieldError("organization")}
      </label>
      <label htmlFor="publication-sector">
        Role or sector
        <select id="publication-sector" required name="sector" defaultValue="" aria-invalid={Boolean(errors.sector)} aria-describedby={errors.sector ? "publication-sector-error" : undefined}>
          <option value="" disabled>Select one</option>
          {PUBLICATION_SECTORS.map((sector) => (
            <option key={sector}>{sector}</option>
          ))}
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
          {regionLabel}
          <input id="publication-state" required autoComplete="address-level1" name="state" aria-invalid={Boolean(errors.state)} aria-describedby={errors.state ? "publication-state-error" : undefined} />
          {fieldError("state")}
        </label>
      </div>
      <label htmlFor="publication-country">
        Country
        <input id="publication-country" required autoComplete="country-name" name="country" value={country} onChange={(event) => setCountry(event.target.value)} aria-invalid={Boolean(errors.country)} aria-describedby={errors.country ? "publication-country-error" : undefined} />
        {fieldError("country")}
      </label>
      <label htmlFor="publication-reason">
        Reason for interest
        <textarea id="publication-reason" required name="reason" rows={4} minLength={MIN_PUBLICATION_REASON_LENGTH} maxLength={800} aria-invalid={Boolean(errors.reason)} aria-describedby={`publication-reason-hint${errors.reason ? " publication-reason-error" : ""}`} />
        <span id="publication-reason-hint">Use at least {MIN_PUBLICATION_REASON_LENGTH} characters. Do not include health or medical information.</span>
        {fieldError("reason")}
      </label>
      <div className={styles.honeypot} aria-hidden="true">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className={styles.checkbox} htmlFor="publication-delivery-consent">
        <input id="publication-delivery-consent" required type="checkbox" name="deliveryConsent" value="yes" aria-invalid={Boolean(errors.deliveryConsent)} aria-describedby={errors.deliveryConsent ? "publication-deliveryConsent-error" : undefined} />
        <span>
          I agree that The SozoRock Foundation, Inc. may use my email to provide
          publication access and send an optional verification link.
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
        {state === "sending" ? "Preparing secure access…" : "Get secure access"}
      </button>
      <p id="access-status" className={state === "error" ? styles.error : styles.status} role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
