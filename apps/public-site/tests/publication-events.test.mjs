import assert from "node:assert/strict";
import test from "node:test";
import { publicationEventNames } from "../app/lib/publication-events.ts";

test("records signed-link issuance without claiming a completed download", () => {
  assert.equal(publicationEventNames.includes("download_link_issued"), true);
  assert.equal(publicationEventNames.includes("publication_downloaded"), false);
  assert.equal(new Set(publicationEventNames).size, publicationEventNames.length);
});
