import { spawnSync } from "node:child_process";

const argumentsList = [
  "ls",
  "sharp",
  "--workspace",
  "@sozorock/public-site",
  "--all",
  "--json",
];
const command = process.platform === "win32"
  ? [process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npm ${argumentsList.join(" ")}`]]
  : ["npm", argumentsList];
const result = spawnSync(command[0], command[1], { encoding: "utf8" });
if (result.error || (result.status !== 0 && result.status !== 1) || !result.stdout) {
  throw result.error || new Error(result.stderr || "Unable to inspect the public dependency tree.");
}
const raw = result.stdout;
const tree = JSON.parse(raw);
const sharpVersions = [];

function visit(node, dependencyName = "") {
  if (dependencyName === "sharp" && typeof node?.version === "string") {
    sharpVersions.push(node.version);
  }
  for (const [name, dependency] of Object.entries(node?.dependencies ?? {})) {
    visit(dependency, name);
  }
}

visit(tree);
if (sharpVersions.length === 0) {
  console.log("Public dependency tree contains no Sharp package.");
  process.exit(0);
}

for (const version of sharpVersions) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    !Number.isInteger(patch) ||
    major < 0 ||
    (major === 0 && minor < 35)
  ) {
    throw new Error(`Public dependency tree contains unsupported Sharp ${version}.`);
  }
}

console.log(`Public dependency tree Sharp versions: ${[...new Set(sharpVersions)].join(", ")}`);
