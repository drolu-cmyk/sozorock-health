import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalCountyLabel } from "../app/lib/explore-labels.ts";
import { GET as getFavicon } from "../app/favicon.ico/route.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("county labels contain one canonical state suffix", () => {
  assert.equal(canonicalCountyLabel("Albany County", "NY"), "Albany County, NY");
  assert.equal(canonicalCountyLabel("Albany County, NY", "ny"), "Albany County, NY");
});

test("Explore reports one available-measure count and hides disabled exports", async () => {
  const [route, component] = await Promise.all([
    source("app/api/explore/route.ts"),
    source("app/explore/ExploreClient.tsx"),
  ]);
  assert.match(route, /availableContextMeasureCount/);
  assert.match(route, /contextMeasureCount: availableContextMeasureCount/);
  assert.match(route, /funderSnapshot: funderSnapshotEnabled/);
  assert.match(component, /All \{data\.dataCoverage\.measureCount\} compatible measures/);
  assert.match(component, /availableContextMeasures\.map/);
  assert.doesNotMatch(component, /data\.metrics\.length \+ data\.contextMeasures\.length/);
  assert.match(component, /data\.capabilities\.funderSnapshot/);
  assert.match(component, /Funder snapshot available after reviewed release/);
});

test("a post-ready MapLibre error does not replace healthy geometry", async () => {
  const component = await source("app/explore/ExploreClient.tsx");
  assert.match(component, /let mapReady = false/);
  assert.match(component, /mapReady = true/);
  assert.match(component, /if \(!cancelled && !mapReady\) setMapError/);
  assert.match(component, /8_000/);
  assert.match(component, /explore-map-nonfatal-error/);
});

test("Explore owns its X metadata and route-specific structured data", async () => {
  const [layout, home, explore] = await Promise.all([
    source("app/layout.tsx"),
    source("app/page.tsx"),
    source("app/explore/page.tsx"),
  ]);
  assert.doesNotMatch(layout, /"@type": "WebPage"/);
  assert.match(home, /"@type": "WebPage"/);
  assert.match(home, /`\$\{siteUrl\}\/\#webpage`/);
  assert.match(explore, /twitter: \{/);
  assert.match(explore, /SozoRock Place Intelligence \| SozoRock Health/);
  assert.match(explore, /`\$\{siteUrl\}\/explore#webpage`/);
  assert.match(explore, /"@type": "SoftwareApplication"/);
});

test("favicon.ico returns genuine icon bytes directly", async () => {
  const response = getFavicon();
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/x-icon");
  assert.ok(bytes.length > 100);
  assert.deepEqual([...bytes.slice(0, 4)], [0, 0, 1, 0]);
});
