import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../../scripts/refresh-cbcap-data.mjs", import.meta.url), "utf8");
const codeqlWorkflow = await readFile(new URL("../../../.github/workflows/codeql.yml", import.meta.url), "utf8");

test("CB-CAP refresh only accepts bounded HTTPS government sources and writes fixed artifacts atomically", () => {
  assert.equal(source.includes('new Set(["tigerweb.geo.census.gov", "data.cdc.gov"])'), true);
  assert.equal(source.includes('parsed.protocol !== "https:"'), true);
  assert.equal(source.includes('redirect: "error"'), true);
  assert.equal(source.includes("MAX_SOURCE_BYTES"), true);
  assert.equal(source.includes('flag: "wx"'), true);
  assert.equal(source.includes("await rename(countyTempPath, countyPath)"), true);
  assert.equal(source.includes("await rename(manifestTempPath, manifestPath)"), true);
  const suppression = "codeql[js/http-to-file-access]";
  assert.equal(source.split(suppression).length - 1, 2);
  assert.equal(codeqlWorkflow.includes("codeql/javascript-queries:AlertSuppression.ql"), true);
  assert.equal(codeqlWorkflow.includes("Expected exactly two reviewed CodeQL source suppressions"), true);
});
