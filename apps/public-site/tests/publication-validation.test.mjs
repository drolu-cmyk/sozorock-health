import assert from "node:assert/strict";
import test from "node:test";
import { parseAccessInput, validateAccessInput } from "../app/lib/publication-validation.ts";

const valid = {
  firstName: " Adaeze ",
  lastName: "Rivera",
  email: "ADAEZE@COUNTYLIBRARY.ORG",
  organization: "County Library",
  sector: "Community organization",
  cityOrRegion: "Albany",
  state: "New York",
  country: "United States",
  reason: "Research and local planning for community access.",
  deliveryConsent: true,
  updatesConsent: false,
  website: "",
};

const minimal = {
  firstName: "Adaeze",
  lastName: "Rivera",
  email: "adaeze@countylibrary.org",
  organization: "",
  sector: "",
  cityOrRegion: "",
  state: "",
  country: "",
  reason: "",
  deliveryConsent: true,
  updatesConsent: false,
  website: "",
};

test("normalizes a valid publication request", () => {
  const input = parseAccessInput(valid);
  assert.equal(input.firstName, "Adaeze");
  assert.equal(input.email, "adaeze@countylibrary.org");
  assert.equal(validateAccessInput(input), null);
});

test("accepts a minimal delivery request without readership profiling", () => {
  const input = parseAccessInput(minimal);
  assert.equal(validateAccessInput(input), null);
  assert.equal(input.organization, "");
  assert.equal(input.country, "");
  assert.equal(input.reason, "");
});

test("normalizes the parent-site compatibility profile back to empty optional fields", () => {
  const input = parseAccessInput({
    ...minimal,
    organization: "Not provided by reader",
    sector: "Other",
    cityOrRegion: "Not provided by reader",
    state: "Not provided by reader",
    country: "Not provided by reader",
    reason: "Publication access requested without optional readership details.",
  });
  assert.equal(validateAccessInput(input), null);
  assert.deepEqual(
    {
      organization: input.organization,
      sector: input.sector,
      cityOrRegion: input.cityOrRegion,
      state: input.state,
      country: input.country,
      reason: input.reason,
    },
    { organization: "", sector: "", cityOrRegion: "", state: "", country: "", reason: "" },
  );
});

test("requires delivery consent independently of update consent", () => {
  const input = parseAccessInput({ ...minimal, deliveryConsent: false, updatesConsent: true });
  assert.match(validateAccessInput(input) ?? "", /Confirm/);
});

test("validates optional organization and sector fields independently", () => {
  const organizationOnly = parseAccessInput({ ...minimal, organization: "County Library" });
  assert.equal(validateAccessInput(organizationOnly), null);

  const unsupportedSector = parseAccessInput({ ...minimal, sector: "Unknown" });
  assert.equal(validateAccessInput(unsupportedSector), "Choose a valid role or sector.");
});

test("validates an optional reason only when supplied", () => {
  const shortReason = parseAccessInput({ ...minimal, reason: "Too short" });
  assert.equal(
    validateAccessInput(shortReason),
    "Use at least 30 meaningful characters to explain your interest.",
  );
});

test("rejects malformed and reserved email addresses", () => {
  const malformed = parseAccessInput({ ...minimal, email: "not-an-email" });
  assert.equal(validateAccessInput(malformed), "Enter a valid email address.");

  const reserved = parseAccessInput({ ...minimal, email: "reader@example.org" });
  assert.equal(validateAccessInput(reserved), "Enter an email address you actually use.");
});

test("rejects placeholder identity fields and invalid structured subdivisions", () => {
  const placeholderName = parseAccessInput({ ...minimal, firstName: "asdf" });
  assert.equal(validateAccessInput(placeholderName), "Enter a real first name rather than placeholder text.");

  const invalidState = parseAccessInput({ ...valid, state: "Synthetic State" });
  assert.equal(
    validateAccessInput(invalidState),
    "Choose or enter a valid state, province, region, county, department, or equivalent.",
  );
});

test("accepts partial optional location context and validates country values when supplied", () => {
  const cityOnly = parseAccessInput({ ...minimal, cityOrRegion: "Albany" });
  assert.equal(validateAccessInput(cityOnly), null);

  const invalidCountry = parseAccessInput({ ...minimal, country: "Not a country" });
  assert.equal(validateAccessInput(invalidCountry), "Choose a valid country.");
});

test("strips control characters", () => {
  const input = parseAccessInput({ ...minimal, firstName: "Ada\u0000eze" });
  assert.equal(input.firstName, "Adaeze");
  assert.equal(validateAccessInput(input), null);
});

test("does not accept truthy strings as consent", () => {
  const input = parseAccessInput({ ...minimal, deliveryConsent: "yes" });
  assert.equal(input.deliveryConsent, false);
});
