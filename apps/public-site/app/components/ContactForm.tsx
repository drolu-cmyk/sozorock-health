"use client";

import { FormEvent, useState } from "react";

type Locale = "en" | "es";

const volunteerAreas = [
  ["Community outreach", "Alcance comunitario"],
  ["Research support", "Apoyo a la investigación"],
  ["Health education support", "Apoyo a la educación en salud"],
  ["Digital navigation", "Navegación digital"],
  ["Event support", "Apoyo en eventos"],
  ["Communications", "Comunicaciones"],
  ["Data and evaluation", "Datos y evaluación"],
  ["Technology and cybersecurity", "Tecnología y ciberseguridad"],
  ["Professional advisory interest", "Interés en asesoría profesional"],
  ["Clinical advisory interest", "Interés en asesoría clínica"],
  ["Other", "Otro"],
] as const;

const formCopy = {
  en: {
    guidance: "Fields marked required must be completed.",
    name: "Full name",
    email: "Email",
    interest: "What would you like to do?",
    role: "Organization or role",
    select: "Select one",
    volunteer: "Volunteer interest",
    location: "City, state, or region",
    outcome: "What outcome are you working toward?",
    consentStart:
      "I agree that The SozoRock Foundation, Inc. may use this information to respond to my inquiry. I have read the",
    privacy: "Privacy Notice",
    send: "Send inquiry",
    sending: "Sending…",
    initial:
      "Please do not include medical, emergency, or protected health information.",
    review: "Review the highlighted fields and try again.",
    received: "Thank you. Your inquiry has been received.",
    failed: "We could not send this right now. Please try again.",
    network:
      "We could not send this right now. Email contact@sozorockfoundation.org if the problem continues.",
    errors: {
      name: "Enter your full name.",
      email: "Enter your email address.",
      invalidEmail: "Enter a valid email address.",
      interest: "Choose what you would like to do.",
      role: "Choose the role that best describes you.",
      volunteer: "Choose a volunteer interest.",
      location: "Enter a city, state, or region.",
      message: "Describe the outcome you are working toward.",
      consent: "Confirm that we may use this information to respond.",
    },
  },
  es: {
    guidance: "Los campos marcados como obligatorios deben completarse.",
    name: "Nombre completo",
    email: "Correo electrónico",
    interest: "¿Qué le gustaría hacer?",
    role: "Organización o función",
    select: "Seleccione una opción",
    volunteer: "Área de interés para voluntariado",
    location: "Ciudad, estado o región",
    outcome: "¿Qué resultado desea lograr?",
    consentStart:
      "Acepto que The SozoRock Foundation, Inc. utilice esta información para responder a mi consulta. He leído el",
    privacy: "Aviso de privacidad",
    send: "Enviar consulta",
    sending: "Enviando…",
    initial:
      "No incluya información médica, de emergencias o de salud protegida.",
    review: "Revise los campos indicados e inténtelo de nuevo.",
    received: "Gracias. Hemos recibido su consulta.",
    failed: "No pudimos enviar la consulta en este momento. Inténtelo de nuevo.",
    network:
      "No pudimos enviar la consulta. Si el problema continúa, escriba a contact@sozorockfoundation.org.",
    errors: {
      name: "Ingrese su nombre completo.",
      email: "Ingrese su correo electrónico.",
      invalidEmail: "Ingrese un correo electrónico válido.",
      interest: "Elija lo que le gustaría hacer.",
      role: "Elija la función que mejor le describa.",
      volunteer: "Elija un área de interés para voluntariado.",
      location: "Ingrese una ciudad, estado o región.",
      message: "Describa el resultado que desea lograr.",
      consent: "Confirme que podemos usar esta información para responder.",
    },
  },
} as const;

const interestOptions = [
  ["Partner with us", "Colaborar con nosotros"],
  ["CB-CAP inquiry", "Consulta sobre CB-CAP"],
  ["BYOP provider partnership", "Colaboración con proveedores BYOP"],
  ["Health Equity Hub partnership", "Colaboración con un Centro de Equidad en Salud"],
  ["Health Access Day partnership", "Colaboración con Health Access Day"],
  ["Fund the work", "Financiar el trabajo"],
  ["Volunteer", "Voluntariado"],
  ["Media inquiry", "Consulta de medios"],
  ["Support research and publications", "Apoyar la investigación y las publicaciones"],
  ["Bring the model to a community", "Llevar el modelo a una comunidad"],
  ["Institutional or public-sector inquiry", "Consulta institucional o del sector público"],
] as const;

const roleOptions = [
  ["Individual or family", "Persona o familia"],
  ["Community organization", "Organización comunitaria"],
  ["Licensed provider or health organization", "Profesional con licencia u organización de salud"],
  ["County, state, or public agency", "Condado, estado u organismo público"],
  ["University or researcher", "Universidad o investigador"],
  ["Foundation or funder", "Fundación o financiador"],
  ["Corporate organization", "Organización empresarial"],
  ["Other", "Otro"],
] as const;

type FieldName =
  | "name"
  | "email"
  | "interest"
  | "organizationType"
  | "volunteerArea"
  | "location"
  | "message"
  | "consent";

type Errors = Partial<Record<FieldName, string>>;

function validate(form: FormData, locale: Locale): Errors {
  const value = (name: FieldName) => String(form.get(name) ?? "").trim();
  const errors: Errors = {};
  const copy = formCopy[locale].errors;
  if (!value("name")) errors.name = copy.name;
  if (!value("email")) errors.email = copy.email;
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("email")))
    errors.email = copy.invalidEmail;
  if (!value("interest")) errors.interest = copy.interest;
  if (!value("organizationType"))
    errors.organizationType = copy.role;
  if (value("interest") === "Volunteer" && !value("volunteerArea"))
    errors.volunteerArea = copy.volunteer;
  if (!value("location")) errors.location = copy.location;
  if (!value("message")) errors.message = copy.message;
  if (form.get("consent") !== "yes")
    errors.consent = copy.consent;
  return errors;
}

export function ContactForm({
  locale = "en",
  initialInterest = "",
}: {
  locale?: Locale;
  initialInterest?: string;
}) {
  const copy = formCopy[locale];
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [interest, setInterest] = useState(
    interestOptions.some(([value]) => value === initialInterest)
      ? initialInterest
      : "",
  );
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string>(copy.initial);

  const clearError = (name: string) => {
    if (!(name in errors)) return;
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const fieldError = (name: FieldName) =>
    errors[name] ? (
      <span className="field-error" id={`${name}-error`} role="alert">
        {errors[name]}
      </span>
    ) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const nextErrors = validate(form, locale);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setState("error");
      setMessage(copy.review);
      const first = Object.keys(nextErrors)[0] as FieldName;
      const control = formElement.elements.namedItem(first);
      if (control instanceof HTMLElement) control.focus();
      return;
    }

    setErrors({});
    setState("sending");
    const raw = Object.fromEntries(form.entries());
    const volunteerArea =
      typeof raw.volunteerArea === "string" ? raw.volunteerArea : "";
    const inquiryMessage = `${volunteerArea ? `Volunteer area: ${volunteerArea}\n` : ""}${String(raw.message ?? "")}`;
    const payload = {
      name: raw.name,
      email: raw.email,
      inquiryType: raw.interest,
      stateOrCounty: raw.location,
      role: raw.organizationType,
      message: inquiryMessage,
      website: raw.website,
      consent: raw.consent === "yes",
    };
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (response.ok) {
        setState("sent");
        setMessage(locale === "es" ? copy.received : result.message ?? copy.received);
        formElement.reset();
        setInterest("");
      } else {
        setState("error");
        setMessage(
          locale === "es" ? copy.failed : result.error ?? copy.failed,
        );
      }
    } catch {
      setState("error");
      setMessage(
        copy.network,
      );
    }
  }

  return (
    <form
      className="partner-form"
      onSubmit={submit}
      onInput={(event) => clearError((event.target as HTMLInputElement).name)}
      aria-describedby="contact-guidance contact-status"
      noValidate
    >
      <p id="contact-guidance">{copy.guidance}</p>
      <div className="form-row">
        <label htmlFor="contact-name">
          {copy.name} <span aria-hidden="true">*</span>
          <input
            id="contact-name"
            required
            name="name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {fieldError("name")}
        </label>
        <label htmlFor="contact-email">
          {copy.email} <span aria-hidden="true">*</span>
          <input
            id="contact-email"
            required
            type="email"
            name="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {fieldError("email")}
        </label>
      </div>
      <div className="form-row">
        <label htmlFor="contact-interest">
          {copy.interest} <span aria-hidden="true">*</span>
          <select
            id="contact-interest"
            required
            name="interest"
            value={interest}
            onChange={(event) => {
              setInterest(event.target.value);
              clearError("interest");
            }}
            aria-invalid={Boolean(errors.interest)}
            aria-describedby={errors.interest ? "interest-error" : undefined}
          >
            <option value="" disabled>{copy.select}</option>
            {interestOptions.map(([value, spanishLabel]) => (
              <option value={value} key={value}>
                {locale === "es" ? spanishLabel : value}
              </option>
            ))}
          </select>
          {fieldError("interest")}
        </label>
        <label htmlFor="contact-role">
          {copy.role} <span aria-hidden="true">*</span>
          <select
            id="contact-role"
            required
            name="organizationType"
            defaultValue=""
            aria-invalid={Boolean(errors.organizationType)}
            aria-describedby={
              errors.organizationType ? "organizationType-error" : undefined
            }
          >
            <option value="" disabled>{copy.select}</option>
            {roleOptions.map(([value, spanishLabel]) => (
              <option value={value} key={value}>
                {locale === "es" ? spanishLabel : value}
              </option>
            ))}
          </select>
          {fieldError("organizationType")}
        </label>
      </div>
      {interest === "Volunteer" && (
        <label htmlFor="contact-volunteer-area">
          {copy.volunteer} <span aria-hidden="true">*</span>
          <select
            id="contact-volunteer-area"
            required
            name="volunteerArea"
            defaultValue=""
            aria-invalid={Boolean(errors.volunteerArea)}
            aria-describedby={
              errors.volunteerArea ? "volunteerArea-error" : undefined
            }
          >
            <option value="" disabled>{copy.select}</option>
            {volunteerAreas.map(([value, spanishLabel]) => (
              <option value={value} key={value}>
                {locale === "es" ? spanishLabel : value}
              </option>
            ))}
          </select>
          {fieldError("volunteerArea")}
        </label>
      )}
      <label htmlFor="contact-location">
        {copy.location} <span aria-hidden="true">*</span>
        <input
          id="contact-location"
          required
          name="location"
          autoComplete="address-level1"
          aria-invalid={Boolean(errors.location)}
          aria-describedby={errors.location ? "location-error" : undefined}
        />
        {fieldError("location")}
      </label>
      <label htmlFor="contact-message">
        {copy.outcome} <span aria-hidden="true">*</span>
        <textarea
          id="contact-message"
          required
          name="message"
          rows={5}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "message-error" : undefined}
        />
        {fieldError("message")}
      </label>
      <input
        className="honeypot"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <label className="consent" htmlFor="contact-consent">
        <input
          id="contact-consent"
          required
          type="checkbox"
          name="consent"
          value="yes"
          aria-invalid={Boolean(errors.consent)}
          aria-describedby={errors.consent ? "consent-error" : undefined}
        />
        <span>
          {copy.consentStart} <a href="/privacy">{copy.privacy}</a>.
          {fieldError("consent")}
        </span>
      </label>
      <button disabled={state === "sending"} type="submit">
        {state === "sending" ? copy.sending : copy.send}
      </button>
      <p
        id="contact-status"
        className={`form-status ${state}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </form>
  );
}
