import { pathToFileURL } from "node:url";

/** Reconcile only database authority; never silently change a published snapshot. */
export function reconcileEvidenceEnvironment({ app, branch, outputs }) {
  const values = Object.fromEntries(outputs.map(({ OutputKey, OutputValue }) => [OutputKey, OutputValue]));
  const secret = values.EvidenceDatabaseSecretArn;
  const cluster = values.EvidenceDatabaseClusterArn;
  const database = values.EvidenceDatabaseName;
  if (!/^arn:aws:secretsmanager:us-east-1:791860731989:secret:sozorock-evidence-runtime-production-[A-Za-z0-9]+$/.test(secret ?? "")
    || secret === values.EvidenceDatabaseAdminSecretArn
    || cluster !== "arn:aws:rds:us-east-1:791860731989:cluster:sozorock-evidence-production"
    || database !== "sozorock_evidence") {
    throw new Error("Production evidence runtime authority does not match the approved stack.");
  }
  const hash = app.EVIDENCE_SNAPSHOT_CONTENT_HASH;
  if (!/^sha256:[a-f0-9]{64}$/.test(hash ?? "")
    || (branch.EVIDENCE_SNAPSHOT_CONTENT_HASH && branch.EVIDENCE_SNAPSHOT_CONTENT_HASH !== hash)) {
    throw new Error("Evidence snapshot pins disagree or are invalid; use the protected evidence publication workflow.");
  }
  const authority = {
    EVIDENCE_DATABASE_SECRET_ARN: secret,
    EVIDENCE_DATABASE_CLUSTER_ARN: cluster,
    EVIDENCE_DATABASE_NAME: database,
  };
  return { app: { ...app, ...authority }, branch: { ...branch, ...authority } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const result = reconcileEvidenceEnvironment(JSON.parse(input));
  process.stdout.write(JSON.stringify(result));
}
