import assert from "node:assert/strict";
import test from "node:test";
import { normalizePlaceBriefKind } from "../app/lib/place-brief-query.ts";

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
