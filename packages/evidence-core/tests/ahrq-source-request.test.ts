import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const builder = readFileSync(
  new URL("../scripts/build-national-ahrq-context.ts", import.meta.url),
  "utf8",
);

test("AHRQ source maintenance requests the canonical published artifacts", () => {
  assert.match(builder, /const response = await fetch\(url, \{/);
  assert.doesNotMatch(builder, /fetch\(\`\$\{url\}\?download=1\`/);
  assert.match(builder, /Referer: sourcePageUrl/);
  assert.match(
    builder,
    /contentType\.includes\("application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet"\)/,
  );
});
