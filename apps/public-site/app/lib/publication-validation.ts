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

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max) : "";
}

export function parseAccessInput(body: Record<string, unknown>): AccessInput {
  return {
    firstName: clean(body.firstName, 80), lastName: clean(body.lastName, 80),
    email: clean(body.email, 254).toLowerCase(), organization: clean(body.organization, 160),
    sector: clean(body.sector, 100), cityOrRegion: clean(body.cityOrRegion, 120),
    state: clean(body.state, 80), country: clean(body.country, 80), reason: clean(body.reason, 800),
    deliveryConsent: body.deliveryConsent === true, updatesConsent: body.updatesConsent === true,
    website: clean(body.website, 120),
  };
}

export function validateAccessInput(input: AccessInput) {
  if (!input.firstName || !input.lastName || !input.email || !input.sector || !input.cityOrRegion || !input.state || !input.country || !input.reason) return "Complete every required field.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return "Enter a valid email address.";
  if (!input.deliveryConsent) return "Confirm that we may email the requested publication access link.";
  return null;
}

