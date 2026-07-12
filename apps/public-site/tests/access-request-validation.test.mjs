import assert from "node:assert/strict";
import test from "node:test";
import {
  hasUnsupportedAccessRequestFields,
  isAllowedAccessOrigin,
  parseAccessRequestInput,
  validateAccessRequestInput,
} from "../app/lib/access-request-validation.ts";

const validCare = {
  journey: "care",
  location: "13753",
  selection: "digital-access-support",
  locale: "en",
  source: "mobile",
  consent: true,
  consentVersion: "mobile-access-v1",
  website: "",
};

test("normalizes the minimum non-clinical mobile access request", () => {
  const input = parseAccessRequestInput({ ...validCare, location: " 13753 " });
  assert.equal(input.location, "13753");
  assert.equal(validateAccessRequestInput(input), null);
});

test("requires explicit versioned consent", () => {
  const input = parseAccessRequestInput({ ...validCare, consent: "true" });
  assert.equal(validateAccessRequestInput(input), "Confirm the privacy notice before continuing.");
});

test("rejects unknown fields so health or identity data cannot enter the contract", () => {
  assert.equal(hasUnsupportedAccessRequestFields({ ...validCare, symptoms: "example" }), true);
  assert.equal(hasUnsupportedAccessRequestFields({ ...validCare, email: "resident@example.org" }), true);
});

test("requires journey-specific values", () => {
  assert.equal(
    validateAccessRequestInput(parseAccessRequestInput({ ...validCare, location: "1375" })),
    "Enter a valid 5-digit ZIP code.",
  );
  assert.equal(
    validateAccessRequestInput(
      parseAccessRequestInput({
        ...validCare,
        journey: "language",
        location: "",
        selection: "asl",
      }),
    ),
    null,
  );
  assert.equal(
    validateAccessRequestInput(
      parseAccessRequestInput({
        ...validCare,
        journey: "hub",
        location: "LHEH-DELHI-01",
        selection: "",
      }),
    ),
    null,
  );
});

test("matches exact HTTPS origins without accepting lookalike hosts", () => {
  const allowed = ["https://health.sozorockfoundation.org"];
  assert.equal(isAllowedAccessOrigin("https://health.sozorockfoundation.org", allowed, true), true);
  assert.equal(isAllowedAccessOrigin("https://health.sozorockfoundation.org.evil.example", allowed, true), false);
  assert.equal(isAllowedAccessOrigin("http://health.sozorockfoundation.org", allowed, true), false);
});

test("permits an explicitly configured localhost origin only outside production", () => {
  const allowed = ["http://localhost:3000"];
  assert.equal(isAllowedAccessOrigin("http://localhost:3000", allowed, false), true);
  assert.equal(isAllowedAccessOrigin("http://localhost:3000", allowed, true), false);
});
