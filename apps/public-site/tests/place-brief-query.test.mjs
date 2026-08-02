import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizePlaceBriefKind } from "../app/lib/place-brief-query.ts";

const routeSource = await readFile(new URL("../app/api/evidence/v1/place-brief/route.ts", import.meta.url), "utf8");

test("kind=county is the canonical place-brief selector", () => {
  assert.deepEqual(normalizePlaceBriefKind(new URLSearchParams("kind=county")), {
    ok: true,
    kind: "county",
    usedLegacyAlias: false,
  });
});

test("legacy geography=county remains a deprecated compatibility alias", () => {
  assert.deepEqual(normalizePlaceBriefKind(new URLSearchParams("geography=county")), {
    ok: true,
    kind: "county",
    usedLegacyAlias: true,
  });
});

test("missing, unsupported and conflicting geography types fail closed", () => {
  assert.equal(normalizePlaceBriefKind(new URLSearchParams()).code, "missing_type");
  assert.equal(normalizePlaceBriefKind(new URLSearchParams("kind=place")).code, "unsupported_type");
  assert.equal(normalizePlaceBriefKind(new URLSearchParams("geography=zip")).code, "unsupported_type");
  assert.equal(normalizePlaceBriefKind(new URLSearchParams("kind=county&geography=place")).code, "conflicting_type");
  assert.equal(normalizePlaceBriefKind(new URLSearchParams("kind=place&geography=county")).code, "conflicting_type");
});

test("matching canonical and legacy parameters remain compatible", () => {
  const result = normalizePlaceBriefKind(new URLSearchParams("kind=county&geography=county"));
  assert.deepEqual(result, { ok: true, kind: "county", usedLegacyAlias: false });
});

test("place-brief validates the query contract before runtime infrastructure", () => {
  const validationStart = routeSource.indexOf("const normalizedKind = normalizePlaceBriefKind");
  const rateLimitStart = routeSource.indexOf("enforceEvidenceRateLimit", validationStart);
  assert.notEqual(validationStart, -1);
  assert.notEqual(rateLimitStart, -1);
  assert.ok(validationStart < rateLimitStart);
  assert.match(routeSource.slice(validationStart, rateLimitStart), /status: 400/);
});
