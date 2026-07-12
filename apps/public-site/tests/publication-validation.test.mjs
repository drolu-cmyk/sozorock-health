import assert from "node:assert/strict";
import test from "node:test";
import { parseAccessInput, validateAccessInput } from "../app/lib/publication-validation.ts";

const valid = { firstName: " Maya ", lastName: "Rivera", email: "MAYA@EXAMPLE.ORG", organization: "County Library", sector: "Community organization", cityOrRegion: "Delhi", state: "New York", country: "United States", reason: "Research and local planning", deliveryConsent: true, updatesConsent: false, website: "" };

test("normalizes a valid publication request", () => {
  const input = parseAccessInput(valid);
  assert.equal(input.firstName, "Maya");
  assert.equal(input.email, "maya@example.org");
  assert.equal(validateAccessInput(input), null);
});

test("requires delivery consent independently of update consent", () => {
  const input = parseAccessInput({ ...valid, deliveryConsent: false, updatesConsent: true });
  assert.match(validateAccessInput(input) ?? "", /Confirm/);
});

test("rejects malformed email and strips control characters", () => {
  const input = parseAccessInput({ ...valid, firstName: "Ma\u0000ya", email: "not-an-email" });
  assert.equal(input.firstName, "Maya");
  assert.equal(validateAccessInput(input), "Enter a valid email address.");
});

test("does not accept truthy strings as consent", () => {
  const input = parseAccessInput({ ...valid, deliveryConsent: "yes" });
  assert.equal(input.deliveryConsent, false);
});
