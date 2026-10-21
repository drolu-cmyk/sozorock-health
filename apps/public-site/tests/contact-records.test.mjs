import assert from "node:assert/strict";
import { test } from "node:test";
import { projectContactRecords } from "../app/lib/contact-records.ts";

test("staff interest records include phone-only contact and retention, but exclude expired and unconsented entries", () => {
  const input = { recordType: "program-interest", firstName: "Alex", lastName: "Example", phone: "5185550123", preferredContact: "phone", county: "Albany", consent: true, expiresAt: 1900000000, notificationStatus: "pending", diagnosis: "must not pass through", submissionId: "internal", heardAbout: "Community notice" };
  const rows = projectContactRecords([input, { ...input, expiresAt: 1 }, { ...input, expiresAt: undefined }, { ...input, consent: false }], "program-interest", 1800000000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].phone, "5185550123");
  assert.equal(rows[0].preferredContact, "phone");
  assert.equal(rows[0].name, "Alex Example");
  assert.equal(rows[0].notificationStatus, "pending");
  assert.ok(rows[0].expiresAt);
  assert.equal("diagnosis" in rows[0], false);
  assert.equal("submissionId" in rows[0], false);
});

test("ordinary contact view preserves its contract and does not mix program-interest records", () => {
  const input = { recordType: "contact", name: "Alex Example", email: "alex@example.org", role: "Partner", stateOrCounty: "New York", message: "General inquiry", createdAt: "2026-10-20" };
  const rows = projectContactRecords([input, { ...input, recordType: "program-interest" }], "contact", 1800000000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].message, "General inquiry");
  assert.equal("phone" in rows[0], false);
});
