import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import manifest from "../app/manifest.ts";
import robots from "../app/robots.ts";
import sitemap from "../app/sitemap.ts";

const dashboardUrl = "https://main.d307qqji18y8il.amplifyapp.com";

test("publishes a bounded public dashboard sitemap and robots policy", () => {
  assert.deepEqual(sitemap(), [
    {
      url: dashboardUrl,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ]);
  assert.deepEqual(robots(), {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${dashboardUrl}/sitemap.xml`,
    host: dashboardUrl,
  });
});

test("links the approved icon from the install manifest", () => {
  const value = manifest();
  assert.equal(value.start_url, "/");
  assert.equal(value.theme_color, "#10251e");
  assert.deepEqual(value.icons, [
    {
      src: "/icon.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ]);
});

test("layout links canonical, manifest, icon, and social image metadata", async () => {
  const source = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(source, /alternates:\s*\{ canonical: "\/" \}/);
  assert.match(source, /manifest: "\/manifest\.webmanifest"/);
  assert.match(source, /url: "\/icon\.png"/);
  assert.match(source, /images: \["\/icon\.png"\]/);
  assert.match(source, /robots:\s*\{/);
});
