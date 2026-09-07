import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { transformSync } from "esbuild";

const source = readFileSync(new URL("../app/api/publications/access/[slug]/route.ts", import.meta.url), "utf8");
const compiled = transformSync(source, { loader: "ts", format: "cjs" }).code;
const module = { exports: {} };
vm.runInNewContext(compiled, {
  module, exports: module.exports, console,
  require(name) {
    if (name === "next/server") return { NextResponse: { json: (body, init) => Response.json(body, init) } };
    if (name.includes("client-dynamodb")) return { ConditionalCheckFailedException: class extends Error {} };
    if (name.endsWith("/publications")) return { getPublication: slug => slug === "known" ? { assetKey: "private.pdf" } : null };
    if (name.endsWith("/publication-access")) return { sameOrigin: request => request.headers.get("origin") === "https://health.sozorockfoundation.org" };
    if (name.endsWith("/request-security")) return { readBoundedText: async request => request.headers.get("content-type") === "application/json" ? { ok: true, text: await request.text() } : { ok: false, error: "unsupported-media-type" } };
    return {};
  },
});

test("all early publication access failures prohibit browser storage and referrers", async () => {
  for (const scenario of [
    { slug: "missing", status: 404 },
    { slug: "known", origin: "https://attacker.invalid", status: 403 },
    { slug: "known", type: "text/plain", status: 415 },
    { slug: "known", body: "{broken", status: 400 },
  ]) {
    const request = new Request("https://health.sozorockfoundation.org/api/publications/access/" + scenario.slug, {
      method: "POST", headers: { origin: scenario.origin || "https://health.sozorockfoundation.org", "content-type": scenario.type || "application/json" }, body: scenario.body || "{}",
    });
    const response = await module.exports.POST(request, { params: Promise.resolve({ slug: scenario.slug }) });
    assert.equal(response.status, scenario.status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(typeof (await response.json()).error, "string");
  }
});
