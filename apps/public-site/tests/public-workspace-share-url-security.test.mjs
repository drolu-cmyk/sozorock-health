import assert from "node:assert/strict";
import test from "node:test";

import { projectPublicWorkspacePlan } from "../app/lib/public-workspace-share.ts";

function planWithUrl(officialUrl) {
  return projectPublicWorkspacePlan({
    workspace: {
      title: "Reviewed plan",
      version: 1,
      updatedAt: "2026-08-17",
      geoid: "36001",
      geographyName: "Albany County",
    },
    sections: [{
      sectionKey: "evidence",
      version: 1,
      updatedAt: "2026-08-17",
      content: {
        public: true,
        reviewStatus: "verified",
        citations: [{
          citationId: "citation-1",
          publisher: "CDC",
          sourceTitle: "Reviewed source",
          officialUrl,
        }],
      },
    }],
    scenarios: [],
    reviewQuestions: [],
  });
}

test("public citation projection accepts a normal public HTTPS URL", () => {
  const projected = planWithUrl("https://data.cdc.gov/places");
  assert.equal(projected.citations[0]?.officialUrl, "https://data.cdc.gov/places");
  assert.equal(projected.sections[0]?.content.citations?.[0]?.officialUrl, "https://data.cdc.gov/places");
});

test("public citation projection rejects credentialed lookalikes and local network URLs", () => {
  for (const unsafeUrl of [
    "https://data.cdc.gov@attacker.invalid/",
    "https://user:password@data.cdc.gov/places",
    "https://127.0.0.1/private",
    "https://localhost/private",
    "http://data.cdc.gov/places",
  ]) {
    const projected = planWithUrl(unsafeUrl);
    assert.equal(projected.citations.length, 0);
    assert.equal(Object.hasOwn(projected.sections[0]?.content.citations?.[0] ?? {}, "officialUrl"), false);
  }
});
