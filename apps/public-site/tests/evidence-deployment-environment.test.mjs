import assert from "node:assert/strict";
import test from "node:test";
import { reconcileEvidenceEnvironment } from "../../../scripts/evidence-deployment-environment.mjs";

const runtime = "arn:aws:secretsmanager:us-east-1:791860731989:secret:sozorock-evidence-runtime-production-Ab1234";
const admin = "arn:aws:secretsmanager:us-east-1:791860731989:secret:rds!cluster-admin-Ab1234";
const hash = `sha256:${"a".repeat(64)}`;
function input() {
  return {
    app: { EVIDENCE_DATABASE_SECRET_ARN: runtime, EVIDENCE_SNAPSHOT_CONTENT_HASH: hash, PUBLICATION_EMAIL_PROVIDER: "google" },
    branch: { EVIDENCE_DATABASE_SECRET_ARN: admin, EVIDENCE_SNAPSHOT_CONTENT_HASH: hash, OTHER_SETTING: "preserve" },
    outputs: Object.entries({ EvidenceDatabaseSecretArn: runtime, EvidenceDatabaseAdminSecretArn: admin,
      EvidenceDatabaseClusterArn: "arn:aws:rds:us-east-1:791860731989:cluster:sozorock-evidence-production",
      EvidenceDatabaseName: "sozorock_evidence" }).map(([OutputKey,OutputValue])=>({OutputKey,OutputValue})),
  };
}
test("an old branch administrator override is replaced without altering publication or snapshot settings", () => {
  const result = reconcileEvidenceEnvironment(input());
  assert.equal(result.branch.EVIDENCE_DATABASE_SECRET_ARN, runtime);
  assert.equal(result.app.EVIDENCE_DATABASE_SECRET_ARN, runtime);
  assert.equal(result.branch.EVIDENCE_SNAPSHOT_CONTENT_HASH, hash);
  assert.equal(result.branch.OTHER_SETTING, "preserve");
  assert.equal(result.app.PUBLICATION_EMAIL_PROVIDER, "google");
});
test("a generic site release cannot reconcile conflicting snapshot approvals", () => {
  const config=input(); config.branch.EVIDENCE_SNAPSHOT_CONTENT_HASH=`sha256:${"b".repeat(64)}`;
  assert.throws(()=>reconcileEvidenceEnvironment(config), /snapshot pins disagree/);
});
test("administrator, staging, missing and foreign-account stack outputs fail closed", () => {
  for (const invalid of [admin, runtime.replace("production", "staging"), undefined, runtime.replace("791860731989", "123456789012")]) {
    const config=input(); config.outputs[0].OutputValue=invalid;
    assert.throws(()=>reconcileEvidenceEnvironment(config), /runtime authority/);
  }
});
