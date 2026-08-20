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

test("normalizes a valid publication request", () => {
  const input = parseAccessInput(valid);
  assert.equal(input.firstName, "Adaeze");
  assert.equal(input.email, "adaeze@countylibrary.org");
  assert.equal(validateAccessInput(input), null);
});

test("requires delivery consent independently of update consent", () => {
  const input = parseAccessInput({ ...valid, deliveryConsent: false, updatesConsent: true });
  assert.match(validateAccessInput(input) ?? "", /Confirm/);
});

test("requires an organization or affiliation", () => {
  const input = parseAccessInput({ ...valid, organization: "" });
  assert.equal(validateAccessInput(input), "Complete every required field.");
});

test("requires an approved sector and a meaningful reason", () => {
  const unsupportedSector = parseAccessInput({ ...valid, sector: "Unknown" });
  assert.equal(validateAccessInput(unsupportedSector), "Choose a valid role or sector.");

  const shortReason = parseAccessInput({ ...valid, reason: "Too short" });
  assert.equal(
    validateAccessInput(shortReason),
    "Use at least 30 meaningful characters to explain your interest.",
  );
});

test("rejects malformed and reserved email addresses", () => {
  const malformed = parseAccessInput({ ...valid, email: "not-an-email" });
  assert.equal(validateAccessInput(malformed), "Enter a valid email address.");

  const reserved = parseAccessInput({ ...valid, email: "reader@example.org" });
  assert.equal(validateAccessInput(reserved), "Enter an email address you actually use.");
});

test("rejects placeholder identity fields and invalid structured subdivisions", () => {
  const placeholderName = parseAccessInput({ ...valid, firstName: "asdf" });
  assert.equal(validateAccessInput(placeholderName), "Enter a real first name rather than placeholder text.");

  const invalidState = parseAccessInput({ ...valid, state: "Synthetic State" });
  assert.equal(
    validateAccessInput(invalidState),
    "Choose or enter a valid state, province, region, county, department, or equivalent.",
  );
});

test("strips control characters", () => {
  const input = parseAccessInput({ ...valid, firstName: "Ada\u0000eze" });
  assert.equal(input.firstName, "Adaeze");
  assert.equal(validateAccessInput(input), null);
});

test("does not accept truthy strings as consent", () => {
  const input = parseAccessInput({ ...valid, deliveryConsent: "yes" });
  assert.equal(input.deliveryConsent, false);
});
