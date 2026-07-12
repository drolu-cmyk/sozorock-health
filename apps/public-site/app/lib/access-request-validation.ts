export const accessJourneys = ["care", "hub", "language"] as const;
export const accessLocales = ["en", "es"] as const;
export const careSelections = [
  "virtual-visit-readiness",
  "digital-access-support",
  "community-resources",
  "not-sure",
] as const;
export const languageSelections = ["en", "es", "asl", "other"] as const;

export type AccessJourney = (typeof accessJourneys)[number];
export type AccessLocale = (typeof accessLocales)[number];

export type AccessRequestInput = {
  journey: string;
  location: string;
  selection: string;
  locale: string;
  source: string;
  consent: boolean;
  consentVersion: string;
  website: string;
};

const allowedKeys = new Set([
  "journey",
  "location",
  "selection",
  "locale",
  "source",
  "consent",
  "consentVersion",
  "website",
]);

function text(body: Record<string, unknown>, name: string, max: number) {
  return typeof body[name] === "string"
    ? body[name]
        .trim()
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .slice(0, max)
    : "";
}

export function hasUnsupportedAccessRequestFields(body: Record<string, unknown>) {
  return Object.keys(body).some((key) => !allowedKeys.has(key));
}

export function parseAccessRequestInput(body: Record<string, unknown>): AccessRequestInput {
  return {
    journey: text(body, "journey", 24).toLowerCase(),
    location: text(body, "location", 80),
    selection: text(body, "selection", 48).toLowerCase(),
    locale: text(body, "locale", 8).toLowerCase(),
    source: text(body, "source", 24).toLowerCase(),
    consent: body.consent === true,
    consentVersion: text(body, "consentVersion", 40),
    website: text(body, "website", 120),
  };
}

export function validateAccessRequestInput(input: AccessRequestInput): string | null {
  if (!accessJourneys.includes(input.journey as AccessJourney)) {
    return "Choose a supported access pathway.";
  }
  if (!accessLocales.includes(input.locale as AccessLocale)) {
    return "Choose a supported interface language.";
  }
  if (input.source !== "mobile") {
    return "This access request source is not supported.";
  }
  if (!input.consent || input.consentVersion !== "mobile-access-v1") {
    return "Confirm the privacy notice before continuing.";
  }

  if (input.journey === "care") {
    if (!/^\d{5}$/.test(input.location)) return "Enter a valid 5-digit ZIP code.";
    if (input.selection && !careSelections.includes(input.selection as (typeof careSelections)[number])) {
      return "Choose a supported readiness option.";
    }
  }

  if (input.journey === "hub") {
    if (!input.location || !/^[\p{L}\p{N}][\p{L}\p{N} .,'&()\/-]{0,79}$/u.test(input.location)) {
      return "Enter a valid Health Equity Hub name or code.";
    }
    if (input.selection) return "This Health Equity Hub request contains an unsupported selection.";
  }

  if (input.journey === "language") {
    if (input.location) return "This language request contains an unsupported location.";
    if (!languageSelections.includes(input.selection as (typeof languageSelections)[number])) {
      return "Choose a supported language option.";
    }
  }

  return null;
}

export function isAllowedAccessOrigin(
  origin: string | null,
  configuredOrigins: readonly string[],
  production = process.env.NODE_ENV === "production",
) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && (production || parsed.hostname !== "localhost")) return false;
    return configuredOrigins.some((allowed) => {
      try {
        const candidate = new URL(allowed);
        return parsed.origin === candidate.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
