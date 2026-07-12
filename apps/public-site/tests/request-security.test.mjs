import assert from "node:assert/strict";
import test from "node:test";
import {
  clientNetworkAddress,
  isTrustedSameOrigin,
  lastForwardedValue,
  readBoundedText,
} from "../app/lib/request-security.ts";

test("uses the trusted final value from multi-hop forwarding headers", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.9, 198.51.100.12",
    "x-forwarded-host": "attacker.example, health.sozorockfoundation.org",
  });
  assert.equal(clientNetworkAddress(headers), "198.51.100.12");
  assert.equal(
    lastForwardedValue(headers, "x-forwarded-host"),
    "health.sozorockfoundation.org",
  );
});

test("requires an exact HTTPS origin matching the trusted public host", () => {
  const trusted = new Request("https://internal.compute.example/api/contact", {
    headers: {
      origin: "https://health.sozorockfoundation.org",
      "x-forwarded-host": "attacker.example, health.sozorockfoundation.org",
    },
  });
  const lookalike = new Request("https://internal.compute.example/api/contact", {
    headers: {
      origin: "https://health.sozorockfoundation.org.attacker.example",
      "x-forwarded-host": "attacker.example, health.sozorockfoundation.org",
    },
  });
  const insecure = new Request("https://internal.compute.example/api/contact", {
    headers: {
      origin: "http://health.sozorockfoundation.org",
      "x-forwarded-host": "health.sozorockfoundation.org",
    },
  });
  assert.equal(isTrustedSameOrigin(trusted), true);
  assert.equal(isTrustedSameOrigin(lookalike), false);
  assert.equal(isTrustedSameOrigin(insecure), false);
});

test("allows an exact configured host and local HTTP development only", () => {
  const configured = new Request("https://internal.compute.example/api/contact", {
    headers: { origin: "https://www.health.sozorockfoundation.org" },
  });
  const local = new Request("http://localhost:3000/api/contact", {
    headers: { origin: "http://localhost:3000", host: "localhost:3000" },
  });
  assert.equal(
    isTrustedSameOrigin(configured, ["www.health.sozorockfoundation.org"]),
    true,
  );
  assert.equal(isTrustedSameOrigin(local), true);
});

test("accepts a bounded body with a permitted media type and charset", async () => {
  const request = new Request("https://example.test/api", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ accepted: true }),
  });
  const result = await readBoundedText(request, 128, ["application/json"]);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(JSON.parse(result.text), { accepted: true });
});

test("rejects an unsupported content type before reading the body", async () => {
  const request = new Request("https://example.test/api", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  });
  assert.deepEqual(await readBoundedText(request, 128, ["application/json"]), {
    ok: false,
    error: "unsupported-media-type",
  });
});

test("enforces actual bytes when Content-Length is absent or inaccurate", async () => {
  const missing = new Request("https://example.test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '"123456789"',
  });
  const inaccurate = new Request("https://example.test/api", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": "1",
    },
    body: '"123456789"',
  });
  assert.deepEqual(await readBoundedText(missing, 5, ["application/json"]), {
    ok: false,
    error: "too-large",
  });
  assert.deepEqual(await readBoundedText(inaccurate, 5, ["application/json"]), {
    ok: false,
    error: "too-large",
  });
});
