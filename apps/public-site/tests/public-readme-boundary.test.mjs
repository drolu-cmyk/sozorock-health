import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readmeUrl = new URL("../../../README.md", import.meta.url);

test("public README contains public destinations without protected implementation detail", async () => {
  const readme = await readFile(readmeUrl, "utf8");

  for (const publicUrl of [
    "https://health.sozorockfoundation.org/",
    "https://ai-lab.sozorockfoundation.org/",
    "https://cbcap.sozorockfoundation.org/",
  ]) {
    assert.equal(readme.includes(publicUrl), true, publicUrl);
  }

  for (const protectedDetail of [
    "## Architecture",
    "## Environment contract",
    "## Automated release",
    "CONTACT_SUBMISSIONS_TABLE",
    "OPENAI_REALTIME_ENABLED",
    "infrastructure/amplify",
    "agentic-ai-architecture",
    "backend-and-release-contract",
    "gpt-live",
  ]) {
    assert.equal(readme.includes(protectedDetail), false, protectedDetail);
  }
});
