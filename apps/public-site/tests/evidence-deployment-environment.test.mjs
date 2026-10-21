import assert from "node:assert/strict";
import test from "node:test";
import { reconcileEvidenceEnvironment } from "../../../scripts/evidence-deployment-environment.mjs";

const hash = `sha256:${"a".repeat(64)}`;
function input() {
  return {
    app: { EVIDENCE_DATABASE_SECRET_ARN: "retired-runtime", EVIDENCE_DATABASE_CLUSTER_ARN: "retired-cluster",
      EVIDENCE_SNAPSHOT_CONTENT_HASH: hash, PUBLICATION_EMAIL_PROVIDER: "google", RUNTIME_ENV: "test" },
    branch: { EVIDENCE_DATABASE_SECRET_ARN: "retired-admin", EVIDENCE_DATABASE_NAME: "retired-database",
      EVIDENCE_DB_CLUSTER_ARN: "retired-alias", AURORA_SECRET_ARN: "retired-alias",
      EVIDENCE_EXPECTED_CLUSTER_ARN: "retired-expectation", EVIDENCE_SNAPSHOT_CONTENT_HASH: hash,
      CONTACT_SUBMISSIONS_TABLE: "contact-table", EXPLORE_COGNITO_CLIENT_ID: "identity-client",
      EVIDENCE_RATE_LIMIT_TABLE: "rate-table", OTHER_SETTING: "preserve" },
  };
}
test("retirement removes database authority at both layers and preserves independent services", () => {
  const original = input();
  const result = reconcileEvidenceEnvironment(original);
  for (const environment of Object.values(result)) {
    assert.equal(environment.RUNTIME_ENV, "production");
    assert.equal(environment.EVIDENCE_SNAPSHOT_CONTENT_HASH, hash);
    assert.ok(Object.keys(environment).every((key) => !/^(EVIDENCE_DATABASE_|EVIDENCE_DB_|AURORA_)/.test(key)));
    assert.equal(environment.EVIDENCE_EXPECTED_CLUSTER_ARN, undefined);
  }
  assert.equal(result.app.PUBLICATION_EMAIL_PROVIDER, "google");
  for (const key of ["CONTACT_SUBMISSIONS_TABLE", "EXPLORE_COGNITO_CLIENT_ID", "EVIDENCE_RATE_LIMIT_TABLE", "OTHER_SETTING"]) {
    assert.equal(result.branch[key], original.branch[key]);
  }
  assert.equal(original.app.RUNTIME_ENV, "test");
  assert.equal(original.branch.EVIDENCE_DATABASE_SECRET_ARN, "retired-admin");
  assert.deepEqual(reconcileEvidenceEnvironment(result), result);
});
test("a generic site release cannot reconcile conflicting or invalid snapshot approvals", () => {
  const config = input(); config.branch.EVIDENCE_SNAPSHOT_CONTENT_HASH = `sha256:${"b".repeat(64)}`;
  assert.throws(() => reconcileEvidenceEnvironment(config), /snapshot pins disagree/);
  for (const invalid of [undefined, "", "sha256:invalid"]) {
    const config = input(); config.app.EVIDENCE_SNAPSHOT_CONTENT_HASH = invalid;
    assert.throws(() => reconcileEvidenceEnvironment(config), /snapshot pins disagree/);
  }
});
test("retirement works without a database stack or branch-level snapshot override", () => {
  const config = input(); delete config.branch.EVIDENCE_SNAPSHOT_CONTENT_HASH;
  const result = reconcileEvidenceEnvironment(config);
  assert.equal(result.app.EVIDENCE_SNAPSHOT_CONTENT_HASH, hash);
  assert.equal(result.branch.EVIDENCE_SNAPSHOT_CONTENT_HASH, undefined);
  assert.equal(result.branch.RUNTIME_ENV, "production");
});
