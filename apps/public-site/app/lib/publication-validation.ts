import {
  getPublicationCountry,
  isValidPublicationSubdivision,
} from "./publication-locations";

export type AccessInput = {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  sector: string;
  cityOrRegion: string;
  state: string;
  country: string;
  reason: string;
  deliveryConsent: boolean;
  updatesConsent: boolean;
  website: string;
};

export const PUBLICATION_SECTORS = [
  "Community organization",
  "County or state agency",
  "Healthcare organization",
  "University or research",
  "Foundation or funder",
  "Policymaker",
  "Student",
  "Individual or family",
  "Other",
] as const;

export const MIN_PUBLICATION_REASON_LENGTH = 30;

const PLACEHOLDER = /^(?:a+|x+|test(?:ing)?|asdf+|qwerty|fake|dummy|unknown|none|n\/?a|nope|sample|placeholder)$/iu;
const RESERVED_EMAIL_DOMAIN = /(?:^|\.)(?:example\.(?:com|net|org)|invalid|localhost|test)$/i;

function clean(value: unknown, max: number) {
  return typeof value === "string"
    ? value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max)
    : "";
}

function normalizedForQuality(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[\s._'’\-]+/g, "");
}

function repeatedPattern(value: string) {
  const normalized = normalizedForQuality(value);
  return normalized.length >= 4 && (/^(.)\1+$/u.test(normalized) || /^(.{1,3})\1{2,}$/u.test(normalized));
}

function hasLetters(value: string, minimum: number) {
  return (value.match(/\p{L}/gu) ?? []).length >= minimum;
}

function meaningfulShortText(value: string, minimumLetters = 2) {
  const normalized = normalizedForQuality(value);
  return Boolean(value.trim()) && hasLetters(value, minimumLetters) && !PLACEHOLDER.test(normalized) && !repeatedPattern(value);
}

function meaningfulName(value: string) {
  if (!meaningfulShortText(value, 2)) return false;
  return /^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-]*$/u.test(value);
}

function meaningfulReason(value: string) {
  if (value.length < MIN_PUBLICATION_REASON_LENGTH || !hasLetters(value, 12)) return false;
  if (repeatedPattern(value)) return false;
  const normalized = normalizedForQuality(value);
  if (PLACEHOLDER.test(normalized)) return false;
  const distinct = new Set([...normalized]).size;
  return distinct >= 6;
}

export function parseAccessInput(body: Record<string, unknown>): AccessInput {
  return {
    firstName: clean(body.firstName, 80), lastName: clean(body.lastName, 80),
    email: clean(body.email, 254).toLowerCase(), organization: clean(body.organization, 160),
    sector: clean(body.sector, 100), cityOrRegion: clean(body.cityOrRegion, 120),
    state: clean(body.state, 120), country: clean(body.country, 100), reason: clean(body.reason, 800),
    deliveryConsent: body.deliveryConsent === true, updatesConsent: body.updatesConsent === true,
    website: clean(body.website, 120),
  };
}

export function validateAccessInput(input: AccessInput) {
  if (!input.firstName || !input.lastName || !input.email || !input.organization || !input.sector || !input.cityOrRegion || !input.state || !input.country || !input.reason) return "Complete every required field.";
  if (!meaningfulName(input.firstName)) return "Enter a real first name rather than placeholder text.";
  if (!meaningfulName(input.lastName)) return "Enter a real last name rather than placeholder text.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return "Enter a valid email address.";
  const emailDomain = input.email.split("@").at(-1) ?? "";
  if (RESERVED_EMAIL_DOMAIN.test(emailDomain)) return "Enter an email address you actually use.";
  if (!meaningfulShortText(input.organization, 3)) return "Enter a meaningful organization or affiliation.";
  if (!PUBLICATION_SECTORS.includes(input.sector as (typeof PUBLICATION_SECTORS)[number])) return "Choose a valid role or sector.";
  if (!meaningfulShortText(input.cityOrRegion, 2)) return "Enter a meaningful city or locality.";
  const country = getPublicationCountry(input.country);
  if (!country) return "Choose a valid country.";
  if (!meaningfulShortText(input.state, 2) || !isValidPublicationSubdivision(country.code, input.state)) return "Choose or enter a valid state, province, region, county, department, or equivalent.";
  if (!meaningfulReason(input.reason)) return `Use at least ${MIN_PUBLICATION_REASON_LENGTH} meaningful characters to explain your interest.`;
  if (!input.deliveryConsent) return "Confirm that we may use your email for publication access.";
  return null;
}

export const publicationValidationInternals = {
  meaningfulName,
  meaningfulReason,
  meaningfulShortText,
  repeatedPattern,
};
