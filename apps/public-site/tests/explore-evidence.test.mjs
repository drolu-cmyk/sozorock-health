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

test("the public explorer exposes only the approved Brief, Map and Action workspace", async () => {
  const component = await source("app/explore/ExploreClient.tsx");
  const rules = await source("app/lib/place-intelligence.ts");
  for (const heading of [
    "SozoRock Place Intelligence",
    "What the local plan says",
    "What the comparable data shows",
    "From evidence to accountable action",
    "No recommendation yet",
  ]) assert.equal(component.includes(heading), true, `missing public section: ${heading}`);
  assert.match(component, /type WorkspaceView = "brief" \| "map" \| "action"/);
  assert.match(component, /role="tablist"/);
  assert.match(component, /role="tabpanel"/);
  assert.match(component, /Not yet verified/);
  assert.match(rules, /"Supported"/);
  assert.match(rules, /"Potentially supported"/);
  assert.match(rules, /"Insufficient evidence"/);
  assert.doesNotMatch(component.toLowerCase(), /sozorock codex/);
});

test("the explore route is discoverable", async () => {
  const sitemap = await source("app/sitemap.ts");
  const page = await source("app/explore/page.tsx");
  assert.match(sitemap, /\/explore/);
  assert.match(page, /canonical: "\/explore"/);
});

test("the public map uses MapLibre with official boundaries and no decorative roads", async () => {
  const component = await source("app/explore/ExploreClient.tsx");
  const geometry = await source("app/api/explore/geometry/route.ts");
  assert.match(component, /import\("maplibre-gl"\)/);
  assert.match(component, /official-boundary/);
  assert.match(component, /verifiedResources/);
  assert.match(component, /The shaded value applies to the selected geography as a whole/);
  assert.doesNotMatch(geometry, /Transportation\/MapServer/);
  assert.doesNotMatch(component, /Major roads|showRoads|heatmap/i);
});

test("directionality and geography are explicit in the public evidence response", async () => {
  const route = await source("app/api/explore/route.ts");
  const metrics = await source("app/lib/explore-health.ts");
  assert.match(route, /interpretationFor/);
  assert.match(route, /trendFor/);
  assert.match(route, /geographyLevel:/);
  assert.match(route, /Census ZIP Code Tabulation Area/);
  assert.match(route, /can overlap more than one county/);
  assert.match(metrics, /higherValueMeaning: "favorable"/);
  assert.match(route, /metric\.interpretation === "adverse_signal"/);
});

test("unverified planning claims remain unavailable to the public Explore view", async () => {
  const route = await source("app/api/explore/route.ts");
  const planning = await source("app/lib/explore-planning-evidence.ts");
  assert.match(route, /claims: \[\]/);
  assert.match(planning, /public-safe metadata only/i);
  assert.match(planning, /not_yet_verified/);
  for (const fips of ["36001", "36093", "36057", "42029", "48029"]) {
    assert.match(planning, new RegExp(`"${fips}"`));
  }
});

test("location search loads selections immediately and supports keyboard discovery", async () => {
  const component = await source("app/explore/ExploreClient.tsx");
  const route = await source("app/api/locations/route.ts");
  assert.match(component, /onSelect\(result\)/);
  assert.match(component, /event\.key === "ArrowDown"/);
  assert.match(component, /event\.key === "ArrowRight"/);
  assert.match(component, /event\.key === "ArrowLeft"/);
  assert.match(component, /aria-activedescendant/);
  assert.match(route, /CENTLAT,CENTLON,AREALAND/);
  assert.match(route, /normalizedSearch/);
  assert.match(route, /COUNTY\|PARISH\|BOROUGH\|CENSUS AREA\|MUNICIPIO\|MUNICIPALITY/);
  assert.match(route, /naturalPlacePriority/);
  assert.match(route, /PR: "72"/);
  assert.match(route, /VI: "78"/);
});

test("the map worker is allowed without weakening the production script policy", async () => {
  const config = await source("next.config.ts");
  assert.match(config, /worker-src 'self' blob:/);
  assert.match(config, /process\.env\.NODE_ENV === "development"/);
  assert.match(config, /: "script-src 'self' 'unsafe-inline'"/);
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
