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

test("the evidence API uses the approved versioned snapshot and validated geography", async () => {
  const route = await source("app/api/explore/route.ts");
  const approvedSnapshot = await source("app/lib/approved-evidence-snapshot.ts");
  const versionedRoute = await source("app/api/evidence/v1/place-brief/route.ts");
  assert.match(route, /getPublishedCountyEvidence/);
  assert.match(route, /sourceCoverage/);
  assert.match(route, /previousMeasureCount/);
  assert.match(route, /buildPlaceIntelligence/);
  assert.match(route, /safeGeoid/);
  assert.match(route, /resolveEvidenceCounty/);
  assert.match(route, /selection_required/);
  assert.match(route, /getHrsaCountyContext/);
  assert.match(route, /workforceContext/);
  assert.match(route, /X-Evidence-Snapshot/);
  assert.match(approvedSnapshot, /county-evidence-snapshot\.v1\.json/);
  assert.match(approvedSnapshot, /buildCountyPlaceBrief/);
  assert.match(versionedRoute, /getPublishedCountyBrief/);
  assert.match(versionedRoute, /normalizePlaceBriefKind/);
  assert.match(versionedRoute, /X-Deprecated-Query-Parameter/);
  for (const datasetId of ["i46a-9kgh", "vgc8-iyc4", "kee5-23sr", "d3i6-k6z5", "hbpe-6r8n", "6jwg-4k37"]) {
    assert.doesNotMatch(route, new RegExp(datasetId));
  }
  assert.doesNotMatch(route, /fetch\(/);
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

test("the public explorer exposes the approved Brief, Map, Action and Visuals workspace", async () => {
  const component = await source("app/explore/ExploreClient.tsx");
  const rules = await source("app/lib/place-intelligence.ts");
  for (const heading of [
    "SozoRock Place Intelligence",
    "What the local plan says",
    "What the comparable data shows",
    "A planning conversation with sources.",
    "No recommendation yet",
  ]) assert.equal(component.includes(heading), true, `missing public section: ${heading}`);
  assert.match(component, /type WorkspaceView = "brief" \| "map" \| "action" \| "visuals"/);
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
  assert.match(component, /data-map-fallback/);
  assert.match(component, /cached official boundary/);
  assert.match(component, /The shaded value applies to the selected geography as a whole/);
  assert.doesNotMatch(geometry, /Transportation\/MapServer/);
  assert.doesNotMatch(component, /Major roads|showRoads|heatmap/i);
});

test("release validators call the versioned place-brief contract with kind", async () => {
  const nationalValidator = await source("scripts/validate-national-api.mjs");
  const stagingWorkflow = await source("../../.github/workflows/milestone-10-staging.yml");
  const productionWorkflow = await source("../../.github/workflows/explore-production.yml");
  for (const content of [nationalValidator, stagingWorkflow, productionWorkflow]) {
    assert.match(content, /place-brief\?kind=county&geoid/);
    assert.doesNotMatch(content, /place-brief\?geography=/);
  }
});

test("live national validation is stratified and stays inside the shared evidence limit", async () => {
  const nationalValidator = await source("scripts/validate-national-api.mjs");
  const evidenceRateLimit = await source("app/lib/evidence-rate-limit.ts");
  assert.match(nationalValidator, /randomStateSample/);
  assert.match(nationalValidator, /liveSample\.length !== 51/);
  assert.match(nationalValidator, /Array\.from\(\{ length: 4 \}/);
  assert.match(nationalValidator, /authoritativeCountyCount: counties\.length/);
  assert.match(nationalValidator, /liveStateAndDcSampleCount: validationCounties\.length/);
  assert.doesNotMatch(nationalValidator, /length: 24/);
  assert.match(evidenceRateLimit, /const maximum = 120/);
});

test("production release pins the Amplify job to the approved commit", async () => {
  const productionWorkflow = await source("../../.github/workflows/explore-production.yml");
  assert.match(productionWorkflow, /start-job[\s\S]*--commit-id "\$RELEASE_SHA"/);
  assert.match(productionWorkflow, /git rev-parse origin\/main\)" = "\$RELEASE_SHA"/);
  assert.match(productionWorkflow, /job\.summary\.commitId/);
  assert.doesNotMatch(productionWorkflow, /deployed_commit" == "HEAD"/);
});

test("production acceptance reports safe authority failures and skips only dependent checks", async () => {
  const productionWorkflow = await source("../../.github/workflows/explore-production.yml");
  assert.match(productionWorkflow, /authority_ready=1/);
  assert.match(productionWorkflow, /authority-error\.json/);
  assert.match(productionWorkflow, /code:\(\.code \/\/ "unclassified"\)/);
  assert.match(productionWorkflow, /authority_ready=0[\s\S]*invalid_authority_contract/);
  assert.match(productionWorkflow, /if \[ "\$authority_ready" -eq 1 \]; then[\s\S]*test:national-api[\s\S]*explore\.visual\.spec\.ts/);
  assert.match(productionWorkflow, /Skipping downstream Explore acceptance because the authority contract probe failed/);
});

test("production reuses an already valid least-privileged runtime login", async () => {
  const productionWorkflow = await source("../../.github/workflows/explore-production.yml");
  assert.match(productionWorkflow, /r\.rolinherit/);
  assert.match(productionWorkflow, /pg_has_role\(current_user, 'evidence_runtime', 'MEMBER'\)/);
  assert.match(productionWorkflow, /runtime_probe_error=\$\(mktemp\)/);
  assert.match(productionWorkflow, /DatabaseErrorException\.\*password authentication failed/);
  assert.match(productionWorkflow, /Runtime login probe failed before contract validation/);
  assert.doesNotMatch(productionWorkflow, /read_runtime_role 2>\/dev\/null \|\| true/);
  assert.match(productionWorkflow, /\|\| ! jq -e[\s\S]*evidence_runtime_login/);
  assert.match(productionWorkflow, /\{"booleanValue":true\},\{"booleanValue":true\}/);
  assert.match(productionWorkflow, /configure_runtime_login\(:runtime_password\)/);
  assert.match(productionWorkflow, /runtime_role=\$\(read_runtime_role\)/);
  assert.match(productionWorkflow, /runtime_snapshot=\$\(aws rds-data execute-statement/);
  assert.match(productionWorkflow, /runtime_geography=\$\(aws rds-data execute-statement/);
  assert.match(productionWorkflow, /--secret-arn "\$EVIDENCE_DATABASE_RUNTIME_SECRET_ARN"/);
  assert.match(productionWorkflow, /EVIDENCE_SNAPSHOT_CONTENT_HASH="\$\{snapshot_id\/snapshot:\/sha256:\}"/);
  assert.match(productionWorkflow, /export EVIDENCE_SNAPSHOT_CONTENT_HASH/);
});

test("production binds Amplify compute to the exact evidence-authorized role", async () => {
  const productionWorkflow = await source("../../.github/workflows/explore-production.yml");
  assert.match(productionWorkflow, /PUBLIC_COMPUTE_ROLE_ARN=\$compute_role_arn/);
  assert.match(productionWorkflow, /update-app[\s\S]*--compute-role-arn "\$PUBLIC_COMPUTE_ROLE_ARN"/);
  assert.match(productionWorkflow, /app\.computeRoleArn/);
  assert.match(productionWorkflow, /app_compute_role" = "\$PUBLIC_COMPUTE_ROLE_ARN"/);
});

test("available measures remain visible when a compatible benchmark is missing", async () => {
  const route = await source("app/api/explore/route.ts");
  const component = await source("app/explore/ExploreClient.tsx");
  assert.doesNotMatch(route, /metric\.value === null \|\| national === null/);
  assert.match(route, /comparison_unavailable/);
  assert.match(component, /Comparison unavailable/);
  assert.match(component, /MetricDetails/);
  assert.match(component, /Universe/);
  assert.match(component, /Source/);
  assert.match(component, /Data period/);
});

test("CDC metadata joins by canonical source measure identifier, not presentation label", async () => {
  const route = await source("app/api/explore/route.ts");
  const helper = await source("app/lib/explore-cdc-metadata.ts");
  assert.match(route, /cdcMeasureDefinitionId/);
  assert.match(route, /indexCdcObservations/);
  assert.match(helper, /measureDefinitionId/);
  assert.match(helper, /sourceVersionId/);
  assert.match(route, /sourceMeasureId: "COPD"/);
  assert.match(route, /sourceMeasureId: "COLON_SCREEN"/);
  assert.doesNotMatch(route, /cdcObservations\.get\(definition\.label\)/);
  assert.doesNotMatch(route, /canonicalSourceMeasureId/);
  assert.match(route, /observation\?\.universe/);
  assert.match(route, /observation\?\.adjustment/);
  assert.match(route, /observation\.dataPeriod/);
  assert.match(route, /observation\?\.confidence/);
});

test("fallback boundary preserves holes, aspect ratio and original search context", async () => {
  const component = await source("app/explore/ExploreClient.tsx");
  const helper = await source("app/lib/explore-map-fallback.ts");
  assert.match(component, /fillRule="evenodd"/);
  assert.match(component, /contextPath/);
  assert.match(component, /hasRenderableGeometry/);
  assert.match(helper, /latitudeScale/);
  assert.match(helper, /offsetX/);
  assert.match(helper, /offsetY/);
  assert.match(helper, /MultiPolygon/);
  assert.match(helper, /compoundPathForPolygons/);
});

test("directionality and geography are explicit in the public evidence response", async () => {
  const route = await source("app/api/explore/route.ts");
  const metrics = await source("app/lib/explore-health.ts");
  const brief = await source("../../packages/evidence-core/src/national/county-brief.ts");
  assert.match(route, /function interpretation/);
  assert.match(route, /geographyLevel:/);
  assert.doesNotMatch(route, /kind !== "county"/);
  assert.match(route, /selectedCountyGeoid/);
  assert.match(brief, /County evidence describes the county as a whole/);
  assert.match(brief, /modeled area estimates/);
  assert.match(metrics, /higherValueMeaning: "favorable"/);
  assert.match(route, /metric\.interpretation === "adverse_signal"/);
});

test("unverified planning claims remain unavailable to the public Explore view", async () => {
  const route = await source("app/api/explore/route.ts");
  const brief = await source("../../packages/evidence-core/src/national/county-brief.ts");
  const planning = await source("app/lib/explore-planning-evidence.ts");
  assert.match(route, /claims: brief\.localPlanningEvidence\.claims/);
  assert.match(brief, /localPlanningEvidence:/);
  assert.match(brief, /status: "not_yet_verified"/);
  assert.match(brief, /documents: \[\]/);
  assert.match(brief, /claims: \[\]/);
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
  assert.match(component, /alreadyIncludesState/);
  assert.match(component, /Population unavailable/);
  assert.match(route, /geography-search-index\.v1\.json/);
  assert.match(route, /normalizedSearch/);
  assert.match(route, /COUNTY\|PARISH\|BOROUGH\|CENSUS AREA\|MUNICIPALITY/);
  assert.match(route, /naturalPlacePriority/);
  assert.doesNotMatch(route, /TIGERweb/);
  assert.doesNotMatch(route, /queryPointLayer/);
});

test("the Explore interface preserves the original search and requires transparent county selection", async () => {
  const component = await source("app/explore/ExploreClient.tsx");
  const resolver = await source("app/lib/county-resolution.ts");
  assert.match(component, /County evidence selection/);
  assert.match(component, /land-area overlap/);
  assert.match(component, /resolution\.original\.label/);
  assert.match(component, /countyGeoid/);
  assert.match(resolver, /calculationMethod: resolutionIndex\.method/);
  assert.match(resolver, /resolutionIndex\.placeCaveat/);
  assert.match(resolver, /overlapPopulationPercent: county\.overlapPopulationPercent/);
  assert.match(resolver, /counties\.length > 1 \? "selection_required"/);
  assert.doesNotMatch(resolver, /tigerweb|@turf|fetch\(/i);
});

test("all compatible measures and source coverage remain available", async () => {
  const component = await source("app/explore/ExploreClient.tsx");
  const route = await source("app/api/explore/route.ts");
  assert.match(component, /All \{data\.dataCoverage\.measureCount\} compatible measures/);
  assert.match(component, /availableContextMeasures\.map/);
  assert.match(component, /Evidence coverage/);
  for (const key of ["chd", "stroke", "cancer", "casthma", "checkup", "cholscreen", "housinsecu", "shututility"]) {
    assert.match(route, new RegExp(`${key}:`));
  }
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
