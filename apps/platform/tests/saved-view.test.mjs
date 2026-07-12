import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_SAVED_VIEW_LENGTH,
  restoreSavedView,
} from "../app/saved-view.ts";

const defaults = {
  state: "All states",
  county: "All counties",
  zip: "All ZIP codes",
  period: "All periods",
  hubType: "All hub types",
  language: "All languages",
  barrier: "All barriers",
  accessRange: "All access levels",
};
const choices = Object.fromEntries(
  Object.entries(defaults).map(([key, value]) => [key, new Set([value])]),
);

test("restores only known string filter values", () => {
  assert.deepEqual(
    restoreSavedView(JSON.stringify({ state: "All states" }), defaults, choices),
    defaults,
  );
  assert.equal(
    restoreSavedView(JSON.stringify({ state: 42 }), defaults, choices),
    null,
  );
  assert.equal(
    restoreSavedView(JSON.stringify({ state: "Injected state" }), defaults, choices),
    null,
  );
});

test("rejects arrays, unknown keys, and oversized saved views", () => {
  assert.equal(restoreSavedView("[]", defaults, choices), null);
  assert.equal(
    restoreSavedView(JSON.stringify({ prototype: "pollution" }), defaults, choices),
    null,
  );
  assert.equal(
    restoreSavedView("x".repeat(MAX_SAVED_VIEW_LENGTH + 1), defaults, choices),
    null,
  );
});
