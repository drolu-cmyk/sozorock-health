import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_SAVED_REPORT_VIEWS,
  MAX_SAVED_VIEW_LENGTH,
  restorePlanningDraft,
  restoreSavedReportViews,
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

test("restores only bounded same-origin stakeholder views", () => {
  const view = {
    id: "2c36d9eb-0f95-4a12-8db2-9fc57ca5885f",
    label: "Delaware County",
    url: "https://cbcap.sozorockfoundation.org/?kind=county&geoid=36025",
    createdAt: "2026-07-13T12:00:00.000Z",
  };
  assert.deepEqual(
    restoreSavedReportViews(JSON.stringify([view]), "https://cbcap.sozorockfoundation.org"),
    [view],
  );
  assert.deepEqual(
    restoreSavedReportViews(JSON.stringify([{ ...view, url: "https://attacker.example/" }]), "https://cbcap.sozorockfoundation.org"),
    [],
  );
  assert.deepEqual(
    restoreSavedReportViews(JSON.stringify([{ ...view, url: "javascript:alert(1)" }]), "https://cbcap.sozorockfoundation.org"),
    [],
  );
});

test("rejects malformed or oversized stakeholder view collections", () => {
  const view = {
    id: "valid-id",
    label: "Nationwide view",
    url: "https://cbcap.sozorockfoundation.org/",
    createdAt: "2026-07-13T12:00:00.000Z",
  };
  assert.deepEqual(restoreSavedReportViews("{broken", "https://cbcap.sozorockfoundation.org"), []);
  assert.deepEqual(
    restoreSavedReportViews(JSON.stringify([{ ...view, unexpected: true }]), "https://cbcap.sozorockfoundation.org"),
    [],
  );
  assert.deepEqual(
    restoreSavedReportViews(JSON.stringify(Array.from({ length: MAX_SAVED_REPORT_VIEWS + 1 }, (_, index) => ({ ...view, id: `id-${index}` }))), "https://cbcap.sozorockfoundation.org"),
    [],
  );
});

test("restores only bounded, geography-scoped planning signals", () => {
  const valid = ["county:36025:diabetes", "place:0811810:uninsured", "community:948278:transportation"];
  assert.deepEqual(restorePlanningDraft(JSON.stringify(valid)), valid);
  assert.deepEqual(restorePlanningDraft(JSON.stringify(["diabetes"])), []);
  assert.deepEqual(restorePlanningDraft(JSON.stringify({ includes: true })), []);
  assert.deepEqual(restorePlanningDraft(JSON.stringify(["county:36025:diabetes", "county:36025:diabetes"])), ["county:36025:diabetes"]);
});
