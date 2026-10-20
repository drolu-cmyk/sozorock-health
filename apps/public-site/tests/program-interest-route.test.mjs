import assert from "node:assert/strict";
import { test } from "node:test";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient } from "@aws-sdk/client-sns";
import { PROGRAM_INTEREST_SUCCESS } from "../app/lib/program-interest.ts";

process.env.CONTACT_SUBMISSIONS_TABLE = "test-contact-submissions";
process.env.CONTACT_NOTIFICATION_TOPIC_ARN = "test-contact-notifications";
process.env.CONTACT_RATE_LIMIT_SALT = "test-only-rate-limit-salt";
process.env.PRIMARY_CARE_COHORT_START_DATE = "2027-01-15";
const { POST } = await import("../app/api/contact/route.ts");
const valid = {
  inquiryType: "program-interest", firstName: "Alex", lastName: "Example",
  email: "alex@example.org", phone: "", preferredContact: "email",
  county: "Albany", newYorkResident: true, ageConfirmed: true, consent: true,
  heardAbout: "Community notice",
};
function request(payload, origin = "https://health.sozorockfoundation.org") {
  return new Request("https://health.sozorockfoundation.org/api/contact", {
    method: "POST", headers: { origin, "content-type": "application/json", "x-forwarded-for": "192.0.2.1" },
    body: JSON.stringify(payload),
  });
}
function clients(t, fail) {
  const writes = [], notifications = [];
  t.mock.method(DynamoDBDocumentClient.prototype, "send", async (command) => {
    if (fail?.(command)) throw Object.assign(new Error("test failure"), { name: fail.nameOverride ?? "StorageError" });
    writes.push(command);
    return {};
  });
  t.mock.method(SNSClient.prototype, "send", async (command) => { notifications.push(command.input); return {}; });
  t.mock.method(Date, "now", () => Date.parse("2026-10-20T12:00:00Z"));
  return { writes, notifications };
}

test("email-only and phone-only requests persist minimal consented records and notify without contact data", async (t) => {
  const { writes, notifications } = clients(t);
  for (const payload of [valid, { ...valid, email: "", phone: "5185550123", preferredContact: "phone" }]) {
    const response = await POST(request(payload));
    assert.equal(response.status, 202);
    assert.equal((await response.json()).message, PROGRAM_INTEREST_SUCCESS);
  }
  const items = writes.filter((command) => command instanceof PutCommand).map((command) => command.input.Item);
  assert.equal(items.length, 2);
  for (const item of items) {
    assert.equal(item.recordType, "program-interest");
    assert.equal(item.expiresAt, Date.parse("2028-01-15T00:00:00-05:00") / 1000);
    assert.equal(item.consent, true);
    assert.equal(item.consentVersion, "2026-10-20");
    for (const key of ["diagnosis", "income", "insurance", "ssn", "dateOfBirth", "message", "website"]) assert.equal(key in item, false);
  }
  assert.equal(items[1].email, "");
  assert.equal(notifications.length, 2);
  for (const notification of notifications) {
    assert.doesNotMatch(notification.Message, /Alex|Example|alex@example.org|5185550123|Community notice/);
  }
  const rate = writes.find((command) => command instanceof UpdateCommand).input;
  assert.equal(rate.ExpressionAttributeValues[":maximum"], 5);
  assert.doesNotMatch(rate.Key.submissionId, /192\.0\.2\.1/);
});

test("invalid, unsupported and cross-origin requests never reach storage", async (t) => {
  const { writes, notifications } = clients(t);
  for (const changes of [{ email: "", phone: "" }, { email: "bad" }, { phone: "123" }, { diagnosis: "not collected" }, { consent: false }]) {
    assert.equal((await POST(request({ ...valid, ...changes }))).status, 400);
  }
  assert.equal((await POST(request(valid, "https://example.org"))).status, 403);
  assert.equal(writes.length, 0);
  assert.equal(notifications.length, 0);
});

test("honeypot and oversized bodies retain the existing abuse controls", async (t) => {
  const { writes } = clients(t);
  assert.equal((await POST(request({ ...valid, website: "bot" }))).status, 202);
  assert.equal((await POST(request({ ...valid, heardAbout: "a".repeat(13000) }))).status, 413);
  assert.equal(writes.length, 0);
});

test("missing cohort configuration fails closed without affecting ordinary inquiries", async (t) => {
  const { writes } = clients(t);
  const previous = process.env.PRIMARY_CARE_COHORT_START_DATE;
  delete process.env.PRIMARY_CARE_COHORT_START_DATE;
  try {
    assert.equal((await POST(request(valid))).status, 503);
    assert.equal(writes.length, 0);
    const ordinary = { name: "Alex Example", email: "alex@example.org", role: "Individual", stateOrCounty: "Albany", message: "General inquiry", consent: true };
    assert.equal((await POST(request(ordinary))).status, 202);
    assert.equal(writes.find((command) => command instanceof PutCommand).input.Item.recordType, "contact");
  } finally { process.env.PRIMARY_CARE_COHORT_START_DATE = previous; }
});

test("failed storage is not reported as success and sends no notification", async (t) => {
  const { notifications } = clients(t, (command) => command instanceof PutCommand);
  assert.equal((await POST(request(valid))).status, 503);
  assert.equal(notifications.length, 0);
});

test("rate-limited requests are rejected before persistence", async (t) => {
  const fail = (command) => command instanceof UpdateCommand;
  fail.nameOverride = "ConditionalCheckFailedException";
  const { writes, notifications } = clients(t, fail);
  assert.equal((await POST(request(valid))).status, 429);
  assert.equal(writes.length, 0);
  assert.equal(notifications.length, 0);
});

test("a stored request remains accepted when its notification fails", async (t) => {
  clients(t);
  t.mock.method(SNSClient.prototype, "send", async () => { throw new Error("test notification failure"); });
  assert.equal((await POST(request(valid))).status, 202);
});
