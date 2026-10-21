import assert from "node:assert/strict";
import test from "node:test";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SNSClient } from "@aws-sdk/client-sns";

process.env.ACCESS_REQUESTS_TABLE = "test-access-requests";
process.env.ACCESS_NOTIFICATION_TOPIC_ARN = "arn:aws:sns:us-east-1:000000000000:test";
process.env.ACCESS_RATE_LIMIT_SALT = "test-only-salt";
process.env.ACCESS_ALLOWED_ORIGINS = "https://health.sozorockfoundation.org";

const { OPTIONS, POST } = await import("../app/v1/access-requests/route.ts");

function request(body, headers = {}) {
  return new Request("https://health.sozorockfoundation.org/v1/access-requests", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const valid = {
  journey: "care",
  location: "13753",
  selection: "digital-access-support",
  locale: "en",
  source: "mobile",
  consent: true,
  consentVersion: "mobile-access-v1",
};

test("rejects requests that are neither an approved origin nor the native client", async () => {
  const response = await POST(request(valid));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("rejects extra health or identity fields before storage", async () => {
  const response = await POST(
    request({ ...valid, diagnosis: "not permitted" }, { "x-sozorock-client": "mobile-v1" }),
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /unsupported/i);
});

test("gives honeypot traffic a non-revealing accepted response without storage", async () => {
  const response = await POST(
    request({ ...valid, website: "https://bot.example" }, { "x-sozorock-client": "mobile-v1" }),
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { accepted: true, pathways: [] });
});

test("returns exact-origin preflight headers without a wildcard", async () => {
  const response = OPTIONS(
    new Request("https://health.sozorockfoundation.org/v1/access-requests", {
      method: "OPTIONS",
      headers: { origin: "https://health.sozorockfoundation.org" },
    }),
  );
  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "https://health.sozorockfoundation.org",
  );
  assert.equal(response.headers.get("access-control-allow-credentials"), null);
});

function streamRequest(chunks, headers = {}) {
  let produced = 0;
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      if (produced < chunks.length) controller.enqueue(chunks[produced++]);
      else controller.close();
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  return {
    request: new Request("https://health.sozorockfoundation.org/v1/access-requests", {
      method: "POST", duplex: "half", body: stream,
      headers: { "content-type": "application/json", "x-sozorock-client": "mobile-v1", ...headers },
    }),
    state: () => ({ produced, cancelled }),
  };
}

test("cancels overflowing native streams before storage despite missing or misleading lengths", async (t) => {
  const writes = t.mock.method(DynamoDBDocumentClient.prototype, "send", async () => ({}));
  const alerts = t.mock.method(SNSClient.prototype, "send", async () => ({}));
  for (const length of [undefined, "1", "invalid"]) {
    const chunks = Array.from({ length: 8 }, () => new Uint8Array(1024).fill(32));
    const input = streamRequest(chunks, length === undefined ? {} : { "content-length": length });
    assert.equal((await POST(input.request)).status, 413);
    assert.deepEqual(input.state(), { produced: 5, cancelled: true });
  }
  assert.equal(writes.mock.callCount(), 0);
  assert.equal(alerts.mock.callCount(), 0);
});

test("enforces UTF-8 bytes and rejects failed reads or JSON lookalike media types", async (t) => {
  const writes = t.mock.method(DynamoDBDocumentClient.prototype, "send", async () => ({}));
  const alerts = t.mock.method(SNSClient.prototype, "send", async () => ({}));
  const bytes = new TextEncoder().encode(JSON.stringify({ ...valid, website: "界".repeat(2000) }));
  const input = streamRequest(Array.from({ length: Math.ceil(bytes.length / 1024) }, (_, i) => bytes.slice(i * 1024, (i + 1) * 1024)));
  assert.equal((await POST(input.request)).status, 413);
  assert.equal(input.state().cancelled, true);
  assert.equal((await POST(request(valid, { "x-sozorock-client": "mobile-v1", "content-type": "application/jsonp" }))).status, 415);
  const failed = new Request("https://health.sozorockfoundation.org/v1/access-requests", {
    method: "POST", duplex: "half", headers: { "content-type": "application/json", "x-sozorock-client": "mobile-v1" },
    body: new ReadableStream({ pull(controller) { controller.error(new Error("disconnected")); } }),
  });
  assert.equal((await POST(failed)).status, 400);
  assert.equal(writes.mock.callCount(), 0);
  assert.equal(alerts.mock.callCount(), 0);
});

test("accepts a genuine 4096-byte native JSON request with charset parameters", async (t) => {
  const commands = [];
  t.mock.method(DynamoDBDocumentClient.prototype, "send", async command => { commands.push(command.constructor.name); return {}; });
  t.mock.method(SNSClient.prototype, "send", async command => { commands.push(command.constructor.name); return {}; });
  const payload = JSON.stringify(valid);
  const response = await POST(new Request("https://health.sozorockfoundation.org/v1/access-requests", {
    method: "POST", body: payload + " ".repeat(4096 - Buffer.byteLength(payload)),
    headers: { "content-type": "Application/JSON; charset=utf-8", "x-sozorock-client": "mobile-v1" },
  }));
  assert.equal(response.status, 202);
  assert.equal((await response.json()).accepted, true);
  assert.deepEqual(commands, ["UpdateCommand", "PutCommand", "PublishCommand"]);
});
