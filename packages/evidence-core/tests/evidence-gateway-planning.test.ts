import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { PLACE_AGENT_EVALUATION_SNAPSHOT } from "../src/agent/evaluation-fixture.ts";
import {
  PLANNING_EVIDENCE_EXTENSION_VERSION,
  attachPlanningEvidenceToGatewayV1,
  buildPlanningEvidenceExtensionV1,
} from "../src/evidence-gateway-planning.ts";
import { buildEvidenceGatewayResponseV1 } from "../src/evidence-gateway.ts";

const geographyId = "county:36001";

function build(overrides: Partial<Parameters<typeof buildPlanningEvidenceExtensionV1>[0]> = {}) {
  return buildPlanningEvidenceExtensionV1({
    geographyId,
    sourceVersions: PLACE_AGENT_EVALUATION_SNAPSHOT.sourceVersions,
    planningDocuments: PLACE_AGENT_EVALUATION_SNAPSHOT.planningDocuments,
    planningClaims: PLACE_AGENT_EVALUATION_SNAPSHOT.claims,
    planningCitations: PLACE_AGENT_EVALUATION_SNAPSHOT.citations,
    ...overrides,
  });
}

test("planning extension emits only reviewed county evidence with page or section provenance", () => {
  const extension = build();
  assert.equal(extension.planning_contract_version, PLANNING_EVIDENCE_EXTENSION_VERSION);
  assert.equal(extension.planning_documents.length, 1);
  assert.equal(extension.planning_claims.length, 1);
  assert.equal(extension.planning_citations.length, 1);
  assert.equal(extension.planning_documents[0]?.current_plan_status, "verified_current");
  assert.equal(extension.planning_claims[0]?.claim_type, "barrier");
  assert.equal(extension.planning_citations[0]?.page_number, 4);
  assert.equal(extension.planning_citations[0]?.artifact_page_index, 3);
  assert.equal("quoted_text" in (extension.planning_citations[0] ?? {}), false);
});

test("provisional documents and wrong-geography evidence are excluded", () => {
  const extension = build({ geographyId: "county:36093" });
  assert.deepEqual(extension.planning_documents, []);
  assert.deepEqual(extension.planning_claims, []);
  assert.deepEqual(extension.planning_citations, []);
});

test("a reviewed claim without a page or section locator is not admitted", () => {
  const citation = PLACE_AGENT_EVALUATION_SNAPSHOT.citations[0];
  assert.ok(citation);
  const extension = build({
    planningCitations: [{
      ...citation,
      pageNumber: null,
      artifactPageIndex: null,
      section: null,
      sourceField: "controlled_field",
    }],
  });
  assert.deepEqual(extension.planning_documents, []);
  assert.deepEqual(extension.planning_claims, []);
  assert.deepEqual(extension.planning_citations, []);
});

test("a claim cannot cross document, source-version, or county boundaries", () => {
  const claim = PLACE_AGENT_EVALUATION_SNAPSHOT.claims[0];
  const citation = PLACE_AGENT_EVALUATION_SNAPSHOT.citations[0];
  assert.ok(claim);
  assert.ok(citation);

  const wrongCounty = build({
    planningClaims: [{ ...claim, geographyIds: ["county:36093"] }],
  });
  assert.equal(wrongCounty.planning_claims.length, 0);

  const wrongSource = build({
    planningCitations: [{ ...citation, sourceVersionId: "source-version:cdc-places-current-eval" }],
  });
  assert.equal(wrongSource.planning_claims.length, 0);
});

test("planning extension is part of the package release hash", () => {
  const geography = PLACE_AGENT_EVALUATION_SNAPSHOT.geographyCatalog.geographies.find((item) => item.id === geographyId);
  const sourceVersion = PLACE_AGENT_EVALUATION_SNAPSHOT.sourceVersions.find((item) => item.id === "source-version:albany-plan-eval");
  assert.ok(geography);
  assert.ok(sourceVersion);

  const base = buildEvidenceGatewayResponseV1({
    releaseId: "planning-extension-evaluation-v1",
    generatedAt: "2026-08-22T22:00:00Z",
    evidenceCoreSchemaVersion: "evidence-core.contracts.v1",
    geographies: [geography],
    sourceCatalog: PLACE_AGENT_EVALUATION_SNAPSHOT.sourceCatalog,
    sourceVersions: [sourceVersion],
    measureDefinitions: [],
    observations: [],
  });
  const combined = attachPlanningEvidenceToGatewayV1(base, build({ sourceVersions: [sourceVersion] }));
  const expected = `sha256:${createHash("sha256").update(JSON.stringify(combined.package)).digest("hex")}`;
  assert.equal(combined.manifest.release_hash, expected);
  assert.notEqual(combined.manifest.release_hash, base.manifest.release_hash);
  assert.equal(combined.package.release_id, base.package.release_id);
});

test("planning extension never serializes private tenant or approval state", () => {
  const serialized = JSON.stringify(build());
  for (const prohibited of ["tenant_id", "approval", "funding_fit", "agent_run", "publication_approved"]) {
    assert.equal(serialized.includes(prohibited), false, `${prohibited} must stay outside public planning evidence`);
  }
});
