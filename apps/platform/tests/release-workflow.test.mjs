import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("pins protected main and reads deployment inputs from the approved commit", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/deploy-cbcap.yml", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /git diff --exit-code/);
  assert.match(workflow, /git status --porcelain --untracked-files=no/);
  assert.match(workflow, /git show HEAD:infrastructure\/amplify\/platform\.yml/);
  assert.match(workflow, /git ls-remote --exit-code "\$EXPECTED_REPOSITORY\.git" refs\/heads\/main/);
  assert.match(workflow, /origin_main_before/);
  assert.match(workflow, /origin_main_after/);
  assert.match(workflow, /deployed_commit" == "HEAD"/);
  assert.match(workflow, /\^\[0-9a-f\]\{7,40\}\$/);
  assert.match(workflow, /\.coverage\.countyCount == 3144/);
  assert.match(workflow, /cbcap-county-map-2025\.json/);
  assert.match(workflow, /\(\.records \| length\) == 3144/);
  assert.match(workflow, /\[\.records\[\]\[0\]\] \| unique \| length/);
  assert.match(workflow, /\.sourceHash == \$expected/);
});
