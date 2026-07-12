import assert from "node:assert/strict";
import test from "node:test";

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
