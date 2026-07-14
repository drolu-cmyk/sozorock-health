import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import manifest from "../app/manifest.ts";
import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";

const dashboardUrl = "https://cbcap.sozorockfoundation.org";

test("publishes the custom-domain sitemap and robots policy", () => {
  assert.deepEqual(sitemap(), [{ url: dashboardUrl, changeFrequency: "monthly", priority: 0.7 }]);
  assert.deepEqual(robots(), {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${dashboardUrl}/sitemap.xml`,
    host: dashboardUrl,
  });
});

test("links the approved icon from the install manifest", () => {
  const value = manifest();
  assert.equal(value.start_url, "/");
  assert.equal(value.theme_color, "#0e2821");
  assert.deepEqual(value.icons, [
    { src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  ]);
});

test("layout links canonical, legal identity, manifest, icon, and social metadata", async () => {
  const source = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(source, /alternates:\s*\{ canonical: "\/" \}/);
  assert.match(source, /manifest: "\/manifest\.webmanifest"/);
  assert.match(source, /url: "\/icon\.png"/);
  assert.match(source, /url: "\/icon-512\.png"/);
  assert.match(source, /images: \["\/icon-512\.png"\]/);
  assert.match(source, /The SozoRock Foundation, Inc\./);
  assert.doesNotMatch(source, /amplifyapp\.com/);
});
