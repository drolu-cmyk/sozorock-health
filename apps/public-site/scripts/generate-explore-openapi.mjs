import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exploreOpenApiDocument } from "../app/lib/explore-openapi.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = [
  path.resolve(root, "../../docs/explore/openapi.json"),
  // JSON is valid YAML 1.2. Keeping both generated from the runtime document
  // prevents the optional YAML artifact from drifting into a second contract.
  path.resolve(root, "../../docs/explore/openapi.yaml"),
];
const generated = `${JSON.stringify(exploreOpenApiDocument, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = await Promise.all(targets.map((target) => readFile(target, "utf8").catch(() => "")));
  if (existing.some((document) => document !== generated)) throw new Error("The committed Explore OpenAPI contract is out of date. Run generate:openapi.");
  console.log("Explore OpenAPI contract is current.");
} else {
  await Promise.all(targets.map((target) => writeFile(target, generated, "utf8")));
  targets.forEach((target) => console.log(`Wrote ${target}`));
}
