import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { prepareProductionDataApiEnvironment } from "./production-data-api-environment.ts";

const SCRIPT_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PACKAGE_ROOT = resolve(SCRIPT_DIR, "..");
const SNAPSHOT_PATH = resolve(PACKAGE_ROOT, "data/national/county-evidence-snapshot.v1.json");

const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as { snapshotId?: string };
if (!snapshot.snapshotId) throw new Error("Production evidence snapshotId is missing.");

prepareProductionDataApiEnvironment(process.env, snapshot.snapshotId);

for (const script of [
  "load-production-evidence-data-api.ts",
  "build-national-context-artifact.ts",
  "load-national-context-data-api.ts",
]) {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", resolve(SCRIPT_DIR, script)],
    {
      cwd: PACKAGE_ROOT,
      env: process.env,
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
