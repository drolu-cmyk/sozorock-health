import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("the homepage place search opens the nationwide explore route", async () => {
  const component = await source("app/components/ApprovedLocationSearch.tsx");
  assert.match(component, /router\.push\(/);
  assert.match(component, /\/explore\?kind=/);
  assert.match(component, /encodeURIComponent\(selected\.geoid\)/);
  assert.match(component, /encodeURIComponent\(immediateChoice\.geoid\)/);
});

test("the evidence API uses fixed current public datasets and validated geography", async () => {
  const route = await source("app/api/explore/route.ts");
  assert.match(route, /i46a-9kgh/);
  assert.match(route, /vgc8-iyc4/);
  assert.match(route, /kee5-23sr/);
  assert.match(route, /d3i6-k6z5/);
  assert.match(route, /hbpe-6r8n/);
  assert.match(route, /6jwg-4k37/);
  assert.match(route, /previousMeasureCount/);
  assert.match(route, /buildPlaceIntelligence/);
  assert.match(route, /release,/);
  assert.match(route, /safeGeoid/);
  assert.match(route, /placeUnavailableMetrics/);
  assert.match(route, /censusAreaContext/);
  assert.match(route, /where: `GEOID='\$\{geoid\}'`/);
  assert.match(route, /label: `\$\{areaContext\.name\}/);
  assert.doesNotMatch(route, /request\.nextUrl\.searchParams\.get\("url"\)/);
});

test("the public route avoids internal product language", async () => {
  const component = (await source("app/explore/ExploreClient.tsx")).toLowerCase();
  for (const phrase of [
    "agentic",
    "grounded summary",
    "interactive prototype",
    "human review required",
    "illustrative composite",
    "internal use",
  ]) {
    assert.equal(component.includes(phrase), false, `public copy contains: ${phrase}`);
  }
});

test("the public explorer exposes the approved Place Intelligence sections and evidence states", async () => {
  const component = await source("app/explore/ExploreClient.tsx");
  const rules = await source("app/lib/place-intelligence.ts");
  for (const heading of [
    "SozoRock Place Intelligence",
    "Location Summary",
    "Key Findings from Current Data",
    "Data-Backed Justification for Health Access Day",
    "Priority Issues &amp; Practical Barriers",
    "Recommended Place-Based Responses",
    "Geospatial &amp; Mapping Insights",
  ]) assert.equal(component.includes(heading), true, `missing public section: ${heading}`);
  assert.match(rules, /"Supported"/);
  assert.match(rules, /"Potentially supported"/);
  assert.match(rules, /"Insufficient evidence"/);
  assert.match(component, /schema.*place-intelligence-v1/);
  assert.match(component, /!payload\.dataCoverage \|\| !payload\.intelligence/);
  assert.doesNotMatch(component.toLowerCase(), /sozorock codex/);
});

test("the explore route is discoverable", async () => {
  const sitemap = await source("app/sitemap.ts");
  const page = await source("app/explore/page.tsx");
  assert.match(sitemap, /\/explore/);
  assert.match(page, /canonical: "\/explore"/);
});

test("the county map normalizes Census rings for d3 and includes major roads", async () => {
  const component = await source("app/explore/ExploreClient.tsx");
  const geometry = await source("app/api/explore/geometry/route.ts");
  assert.match(component, /orientBoundaryForD3/);
  assert.match(component, /Zoom in/);
  assert.match(component, /Reset map/);
  assert.match(component, /aria-pressed=\{showRoads\}/);
  assert.match(geometry, /outFields: "NAME,RTTYP"/);
  assert.match(geometry, /arcGisGeoJson\(`\$\{base\}\/3\/query`/);
});

test("location search loads selections immediately and supports keyboard discovery", async () => {
  const component = await source("app/explore/ExploreClient.tsx");
  const route = await source("app/api/locations/route.ts");
  assert.match(component, /onSelect\(result\)/);
  assert.match(component, /event\.key === "ArrowDown"/);
  assert.match(component, /aria-activedescendant/);
  assert.match(route, /CENTLAT,CENTLON,AREALAND/);
  assert.match(route, /normalizedSearch/);
  assert.match(route, /COUNTY\|PARISH\|BOROUGH\|CENSUS AREA\|MUNICIPIO\|MUNICIPALITY/);
  assert.match(route, /naturalPlacePriority/);
  assert.match(route, /PR: "72"/);
  assert.match(route, /VI: "78"/);
});

test("the approved live homepage assets and contact path remain locked", async () => {
  const component = await source("app/components/ApprovedMarketingHome.jsx");
  assert.match(component, /hero-community-desktop-v2\.webp/);
  assert.match(component, /hero-community-mobile-v2\.webp/);
  assert.match(component, /ride-barrier-v2\.webp/);
  assert.match(component, /portal-barrier-v2\.webp/);
  assert.match(component, /appointment-distance\.webp/);
  assert.match(component, /library-hub-v2\.webp/);
  assert.match(component, /href="\/contact"/);
  assert.doesNotMatch(component, /Nonprofit health-equity systems infrastructure/);
});
