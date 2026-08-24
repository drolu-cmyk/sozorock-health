type ImportEnvironment = Record<string, string | undefined>;

function normalized(value: string | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function resolveAlias(
  env: ImportEnvironment,
  names: readonly string[],
  label: string,
) {
  const values = names
    .map((name) => normalized(env[name]))
    .filter((value): value is string => Boolean(value));
  const unique = [...new Set(values)];
  if (unique.length === 0) throw new Error(`${label} is required.`);
  if (unique.length > 1) throw new Error(`${label} environment aliases disagree.`);
  return unique[0];
}

export function snapshotHashFromId(snapshotId: string) {
  const normalizedId = snapshotId.trim();
  if (!/^snapshot:[0-9a-fA-F]{64}$/.test(normalizedId)) {
    throw new Error("Production evidence snapshotId must be snapshot:<sha256>.");
  }
  return `sha256:${normalizedId.slice("snapshot:".length).toLowerCase()}`;
}

export function prepareProductionDataApiEnvironment(
  env: ImportEnvironment,
  snapshotId: string,
) {
  const clusterArn = resolveAlias(
    env,
    ["EVIDENCE_DATABASE_CLUSTER_ARN", "EVIDENCE_DB_CLUSTER_ARN", "AURORA_CLUSTER_ARN"],
    "Evidence database cluster ARN",
  );
  const secretArn = resolveAlias(
    env,
    ["EVIDENCE_DATABASE_SECRET_ARN", "EVIDENCE_DB_SECRET_ARN", "AURORA_SECRET_ARN"],
    "Evidence database secret ARN",
  );
  const expectedArn = normalized(env.EVIDENCE_EXPECTED_CLUSTER_ARN);
  if (expectedArn && expectedArn !== clusterArn) {
    throw new Error("Evidence database cluster ARN does not match the approved target.");
  }

  const snapshotHash = snapshotHashFromId(snapshotId);
  const configuredSnapshotHash = normalized(env.EVIDENCE_SNAPSHOT_CONTENT_HASH);
  if (configuredSnapshotHash && configuredSnapshotHash.toLowerCase() !== snapshotHash) {
    throw new Error("Evidence snapshot hash does not match the approved production snapshot.");
  }

  env.EVIDENCE_DATABASE_CLUSTER_ARN = clusterArn;
  env.EVIDENCE_DB_CLUSTER_ARN = clusterArn;
  env.EVIDENCE_DATABASE_SECRET_ARN = secretArn;
  env.EVIDENCE_DB_SECRET_ARN = secretArn;
  env.EVIDENCE_SNAPSHOT_CONTENT_HASH = snapshotHash;

  return { clusterArn, secretArn, snapshotHash };
}
