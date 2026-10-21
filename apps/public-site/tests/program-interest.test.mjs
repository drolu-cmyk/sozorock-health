import assert from "node:assert/strict";
import { test } from "node:test";
import { NEW_YORK_COUNTIES, validateProgramInterest, programInterestExpiry } from "../app/lib/program-interest.ts";

const valid = {
  inquiryType: "program-interest", firstName: "Alex", lastName: "Example",
  email: "alex@example.org", phone: "", preferredContact: "email",
  county: "Albany", newYorkResident: true, ageConfirmed: true, consent: true,
  heardAbout: "",
};

test("all 62 New York counties are accepted", () => {
  assert.equal(NEW_YORK_COUNTIES.length, 62);
  assert.equal(new Set(NEW_YORK_COUNTIES).size, 62);
  for (const county of NEW_YORK_COUNTIES) assert.equal(validateProgramInterest({ ...valid, county }).ok, true);
  assert.equal(validateProgramInterest({ ...valid, county: "Outside New York" }).ok, false);
});

test("accepts email-only, phone-only, text and both contacts", () => {
  for (const changes of [
    {},
    { email: "", phone: "(518) 555-0123", preferredContact: "phone" },
    { email: "", phone: "+1 518 555 0123", preferredContact: "text" },
    { phone: "+44 20 7946 0123" },
  ]) assert.equal(validateProgramInterest({ ...valid, ...changes }).ok, true);
});

test("rejects missing or malformed contacts and mismatched preferences", () => {
  for (const changes of [
    { email: "", phone: "" }, { email: "invalid" },
    { phone: "123" }, { phone: "5185550123 extension" },
    { preferredContact: "fax" }, { email: "", phone: "5185550123" },
    { preferredContact: "phone" },
    { email: 123 }, { phone: ["5185550123"] },
  ]) assert.equal(validateProgramInterest({ ...valid, ...changes }).ok, false);
});

test("requires names and explicit confirmations; bounds referral text", () => {
  for (const key of ["firstName", "lastName", "newYorkResident", "ageConfirmed", "consent"]) {
    assert.equal(validateProgramInterest({ ...valid, [key]: "" }).ok, false);
  }
  assert.equal(validateProgramInterest({ ...valid, heardAbout: "a".repeat(200) }).ok, true);
  assert.equal(validateProgramInterest({ ...valid, heardAbout: "a".repeat(201) }).ok, false);
  assert.equal(validateProgramInterest({ ...valid, firstName: "a".repeat(81) }).ok, false);
  assert.equal(validateProgramInterest({ ...valid, firstName: "Alex\nExample" }).ok, false);
});

test("rejects health and other unsupported fields instead of storing them", () => {
  for (const key of ["diagnosis", "income", "insurance", "ssn", "dateOfBirth", "message", "expiresAt"]) {
    assert.equal(validateProgramInterest({ ...valid, [key]: "not collected" }).ok, false);
  }
});

test("expiration follows the configured cohort date, never submission time", () => {
  assert.equal(programInterestExpiry("2027-01-01"), Date.parse("2028-01-01T00:00:00-05:00") / 1000);
  assert.equal(programInterestExpiry("2027-01-15"), Date.parse("2028-01-15T00:00:00-05:00") / 1000);
  for (const value of [undefined, "", "2027-01-32", "2027-02-01", "2026-01-01", "2027-01-01T00:00:00Z"]) {
    assert.equal(programInterestExpiry(value), null);
  }
});
