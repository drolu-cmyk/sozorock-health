import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareProductionDataApiEnvironment,
  snapshotHashFromId,
} from "../scripts/production-data-api-environment.ts";

const clusterArn = "arn:aws:rds:us-east-1:123456789012:cluster:evidence-production";
const secretArn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:evidence-production";
const snapshotId = `snapshot:${"a".repeat(64)}`;

test("production import normalizes governed database environment names for both loaders", () => {
  const env: Record<string, string | undefined> = {
    EVIDENCE_DATABASE_CLUSTER_ARN: clusterArn,
    EVIDENCE_DATABASE_SECRET_ARN: secretArn,
    EVIDENCE_EXPECTED_CLUSTER_ARN: clusterArn,
  };

  const resolved = prepareProductionDataApiEnvironment(env, snapshotId);

  assert.equal(resolved.clusterArn, clusterArn);
  assert.equal(resolved.secretArn, secretArn);
  assert.equal(resolved.snapshotHash, `sha256:${"a".repeat(64)}`);
  assert.equal(env.EVIDENCE_DB_CLUSTER_ARN, clusterArn);
  assert.equal(env.EVIDENCE_DB_SECRET_ARN, secretArn);
  assert.equal(env.EVIDENCE_SNAPSHOT_CONTENT_HASH, `sha256:${"a".repeat(64)}`);
});

test("legacy aliases remain accepted only when they agree with governed names", () => {
  const env: Record<string, string | undefined> = {
    EVIDENCE_DATABASE_CLUSTER_ARN: clusterArn,
    EVIDENCE_DB_CLUSTER_ARN: clusterArn,
    AURORA_CLUSTER_ARN: clusterArn,
    EVIDENCE_DATABASE_SECRET_ARN: secretArn,
    EVIDENCE_DB_SECRET_ARN: secretArn,
    AURORA_SECRET_ARN: secretArn,
  };

  assert.doesNotThrow(() => prepareProductionDataApiEnvironment(env, snapshotId));
  env.EVIDENCE_DB_CLUSTER_ARN = `${clusterArn}-different`;
  assert.throws(
    () => prepareProductionDataApiEnvironment(env, snapshotId),
    /environment aliases disagree/,
  );
});

test("production import rejects a database target or snapshot identity that differs from approval", () => {
  assert.throws(
    () => prepareProductionDataApiEnvironment({
      EVIDENCE_DATABASE_CLUSTER_ARN: clusterArn,
      EVIDENCE_DATABASE_SECRET_ARN: secretArn,
      EVIDENCE_EXPECTED_CLUSTER_ARN: `${clusterArn}-other`,
    }, snapshotId),
    /does not match the approved target/,
  );

  assert.throws(
    () => prepareProductionDataApiEnvironment({
      EVIDENCE_DATABASE_CLUSTER_ARN: clusterArn,
      EVIDENCE_DATABASE_SECRET_ARN: secretArn,
      EVIDENCE_SNAPSHOT_CONTENT_HASH: `sha256:${"b".repeat(64)}`,
    }, snapshotId),
    /does not match the approved production snapshot/,
  );
});

test("snapshot IDs are converted to the hash form expected by national-context import", () => {
  assert.equal(snapshotHashFromId(snapshotId), `sha256:${"a".repeat(64)}`);
  assert.throws(() => snapshotHashFromId("snapshot:not-a-hash"), /snapshot:<sha256>/);
});
