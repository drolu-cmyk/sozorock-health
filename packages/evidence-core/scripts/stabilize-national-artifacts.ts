import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "..", "..");

type JsonPath = readonly string[];

type ArtifactRule = {
  path: string;
  volatilePaths: readonly JsonPath[];
};

export const nationalContextArtifactRules: ArtifactRule[] = [
  {
    path: "packages/evidence-core/data/national/acs-county-context.v1.json",
    volatilePaths: [["generatedAt"], ["source", "retrievedAt"]],
  },
  {
    path: "packages/evidence-core/data/national/hrsa-county-context.v1.json",
    volatilePaths: [["generatedAt"]],
  },
  {
    path: "packages/evidence-core/data/national/ahrf-county-context.v1.json",
    volatilePaths: [["generatedAt"]],
  },
  {
    path: "packages/evidence-core/data/national/ahrq-clh-county-context.v1.json",
    volatilePaths: [["generatedAt"]],
  },
];

export const nationalCoverageArtifactRules: ArtifactRule[] = [
  {
    path: "packages/evidence-core/data/national/county-evidence-snapshot.v1.json",
    volatilePaths: [["generatedAt"], ["snapshotId"]],
  },
  {
    path: "packages/evidence-core/data/national/national-coverage-report.v1.json",
    volatilePaths: [["generatedAt"], ["snapshotId"], ["randomStateSample"]],
  },
];

function withoutVolatilePaths(
  value: unknown,
  volatilePaths: readonly JsonPath[],
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const stable = structuredClone(value) as Record<string, unknown>;
  for (const volatilePath of volatilePaths) {
    if (!volatilePath.length) continue;
    let parent: unknown = stable;
    for (const segment of volatilePath.slice(0, -1)) {
      if (!parent || typeof parent !== "object" || Array.isArray(parent)) {
        parent = undefined;
        break;
      }
      parent = (parent as Record<string, unknown>)[segment];
    }
    if (parent && typeof parent === "object" && !Array.isArray(parent)) {
      delete (parent as Record<string, unknown>)[volatilePath.at(-1)!];
    }
  }
  return stable;
}

export function artifactsMatchExceptVolatileMetadata(
  checkedInRaw: string,
  candidateRaw: string,
  volatilePaths: readonly JsonPath[],
): boolean {
  const checkedIn = withoutVolatilePaths(
    JSON.parse(checkedInRaw),
    volatilePaths,
  );
  const candidate = withoutVolatilePaths(
    JSON.parse(candidateRaw),
    volatilePaths,
  );
  return isDeepStrictEqual(checkedIn, candidate);
}

export function artifactGroupMatchesExceptVolatileMetadata(
  artifacts: ReadonlyArray<{
    checkedInRaw: string;
    candidateRaw: string;
    volatilePaths: readonly JsonPath[];
  }>,
): boolean {
  return artifacts.every((artifact) =>
    artifactsMatchExceptVolatileMetadata(
      artifact.checkedInRaw,
      artifact.candidateRaw,
      artifact.volatilePaths,
    ));
}

function checkedInArtifact(rule: ArtifactRule) {
  return execFileSync("git", ["show", `HEAD:${rule.path}`], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

export async function stabilizeNationalArtifacts() {
  const stabilized: string[] = [];
  const substantiveChanges: string[] = [];

  for (const rule of nationalContextArtifactRules) {
    const artifactPath = path.join(repoRoot, rule.path);
    const candidateRaw = await readFile(artifactPath, "utf8");
    let checkedInRaw: string;
    try {
      checkedInRaw = checkedInArtifact(rule);
    } catch {
      substantiveChanges.push(rule.path);
      continue;
    }

    if (artifactsMatchExceptVolatileMetadata(
      checkedInRaw,
      candidateRaw,
      rule.volatilePaths,
    )) {
      if (checkedInRaw !== candidateRaw) {
        await writeFile(artifactPath, checkedInRaw);
        stabilized.push(rule.path);
      }
    } else {
      substantiveChanges.push(rule.path);
    }
  }

  const coverageArtifacts = [];
  try {
    for (const rule of nationalCoverageArtifactRules) {
      coverageArtifacts.push({
        rule,
        artifactPath: path.join(repoRoot, rule.path),
        checkedInRaw: checkedInArtifact(rule),
        candidateRaw: await readFile(path.join(repoRoot, rule.path), "utf8"),
      });
    }
  } catch {
    substantiveChanges.push(...nationalCoverageArtifactRules.map((rule) => rule.path));
  }

  if (coverageArtifacts.length === nationalCoverageArtifactRules.length) {
    const coverageGroupIsStable = artifactGroupMatchesExceptVolatileMetadata(
      coverageArtifacts.map(({ rule, checkedInRaw, candidateRaw }) => ({
        checkedInRaw,
        candidateRaw,
        volatilePaths: rule.volatilePaths,
      })),
    );
    if (coverageGroupIsStable) {
      for (const artifact of coverageArtifacts) {
        if (artifact.checkedInRaw !== artifact.candidateRaw) {
          await writeFile(artifact.artifactPath, artifact.checkedInRaw);
          stabilized.push(artifact.rule.path);
        }
      }
    } else {
      substantiveChanges.push(
        ...coverageArtifacts
          .filter(({ rule, checkedInRaw, candidateRaw }) =>
            !artifactsMatchExceptVolatileMetadata(
              checkedInRaw,
              candidateRaw,
              rule.volatilePaths,
            ))
          .map(({ rule }) => rule.path),
      );
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
