import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exploreOpenApiDocument } from "../app/lib/explore-openapi.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.resolve(root, "../../docs/explore/openapi.json");
const generated = `${JSON.stringify(exploreOpenApiDocument, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = await readFile(target, "utf8").catch(() => "");
  if (existing !== generated) throw new Error("The committed Explore OpenAPI contract is out of date. Run generate:openapi.");
  console.log("Explore OpenAPI contract is current.");
} else {
  await writeFile(target, generated, "utf8");
  console.log(`Wrote ${target}`);
}
