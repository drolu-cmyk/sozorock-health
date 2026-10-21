import { pathToFileURL } from "node:url";

/** Retire database authority in both Amplify layers without changing a published snapshot. */
export function reconcileEvidenceEnvironment({ app, branch }) {
  const hash = app.EVIDENCE_SNAPSHOT_CONTENT_HASH;
  if (!/^sha256:[a-f0-9]{64}$/.test(hash ?? "")
    || (branch.EVIDENCE_SNAPSHOT_CONTENT_HASH && branch.EVIDENCE_SNAPSHOT_CONTENT_HASH !== hash)) {
    throw new Error("Evidence snapshot pins disagree or are invalid; use the protected evidence publication workflow.");
  }
  function retiredEnvironment(environment) {
    const preserved = Object.fromEntries(Object.entries(environment).filter(([key]) =>
      !key.startsWith("EVIDENCE_DATABASE_") && !key.startsWith("EVIDENCE_DB_") &&
      !key.startsWith("AURORA_") && key !== "EVIDENCE_EXPECTED_CLUSTER_ARN"));
    // Missing authority must fail closed in production, never select local fixtures.
    return { ...preserved, RUNTIME_ENV: "production" };
  }
  return { app: retiredEnvironment(app), branch: retiredEnvironment(branch) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const result = reconcileEvidenceEnvironment(JSON.parse(input));
  process.stdout.write(JSON.stringify(result));
}
