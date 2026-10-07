import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "..", "..");

type ArtifactRule = {
  path: string;
  volatileTopLevelKeys: string[];
};

export const nationalArtifactRules: ArtifactRule[] = [
  {
    path: "packages/evidence-core/data/national/acs-county-context.v1.json",
    volatileTopLevelKeys: ["generatedAt", "retrievedAt"],
  },
  {
    path: "packages/evidence-core/data/national/hrsa-county-context.v1.json",
    volatileTopLevelKeys: ["generatedAt", "retrievedAt"],
  },
  {
    path: "packages/evidence-core/data/national/ahrf-county-context.v1.json",
    volatileTopLevelKeys: ["generatedAt", "retrievedAt"],
  },
  {
    path: "packages/evidence-core/data/national/ahrq-clh-county-context.v1.json",
    volatileTopLevelKeys: ["generatedAt", "retrievedAt"],
  },
  {
    path: "packages/evidence-core/data/national/county-evidence-snapshot.v1.json",
    volatileTopLevelKeys: ["generatedAt", "snapshotId"],
  },
  {
    path: "packages/evidence-core/data/national/national-coverage-report.v1.json",
    volatileTopLevelKeys: ["generatedAt", "snapshotId", "randomStateSample"],
  },
];

function withoutVolatileTopLevelKeys(
  value: unknown,
  volatileTopLevelKeys: string[],
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const stable = structuredClone(value) as Record<string, unknown>;
  for (const key of volatileTopLevelKeys) delete stable[key];
  return stable;
}

export function artifactsMatchExceptVolatileMetadata(
  checkedInRaw: string,
  candidateRaw: string,
  volatileTopLevelKeys: string[],
): boolean {
  const checkedIn = withoutVolatileTopLevelKeys(
    JSON.parse(checkedInRaw),
    volatileTopLevelKeys,
  );
  const candidate = withoutVolatileTopLevelKeys(
    JSON.parse(candidateRaw),
    volatileTopLevelKeys,
  );
  return isDeepStrictEqual(checkedIn, candidate);
}

export async function stabilizeNationalArtifacts() {
  const stabilized: string[] = [];
  const substantiveChanges: string[] = [];

  for (const rule of nationalArtifactRules) {
    const artifactPath = path.join(repoRoot, rule.path);
    const candidateRaw = await readFile(artifactPath, "utf8");
    let checkedInRaw: string;
    try {
      checkedInRaw = execFileSync("git", ["show", `HEAD:${rule.path}`], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch {
      substantiveChanges.push(rule.path);
      continue;
    }

    if (artifactsMatchExceptVolatileMetadata(
      checkedInRaw,
      candidateRaw,
      rule.volatileTopLevelKeys,
    )) {
      if (checkedInRaw !== candidateRaw) {
        await writeFile(artifactPath, checkedInRaw);
        stabilized.push(rule.path);
      }
    } else {
      substantiveChanges.push(rule.path);
    }
  }

  console.log(JSON.stringify({ stabilized, substantiveChanges }, null, 2));
}

if (
  process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await stabilizeNationalArtifacts();
}
