import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships nationwide search, planning, scenario, AI-governance, and report surfaces", async () => {
  const [dashboard, planning, intelligence, geography, nationalSearch, profile, profileContract, trends, report] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PlanningWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/IntelligenceBrief.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/geography/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/national-geography-search.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/cdc-profile-contract.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trends/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ReportStudio.tsx", import.meta.url), "utf8"),
  ]);
  for (const phrase of ["Health Equity Hub", "Print / save PDF", "Browse all county equivalents"]) {
    assert.ok(dashboard.includes(phrase), `Missing product phrase: ${phrase}`);
  }
  assert.match(planning, /CHA \/ CHIP workspace/);
  assert.match(intelligence, /AI-assisted briefing with human review/);
  assert.match(intelligence, /AI drafts\. People decide\./);
  assert.match(geography, /searchNationalGeographies/);
  assert.match(geography, /counties, states/);
  assert.match(nationalSearch, /searchCommittedGeographies/);
  assert.match(nationalSearch, /PLACE_BASE/);
  assert.match(nationalSearch, /PLACE_BASE}\/1\/query/);
  assert.match(nationalSearch, /PLACE_BASE}\/3\/query/);
  assert.match(nationalSearch, /PUMA_TAD_TAZ_UGA_ZCTA/);
  assert.match(profile, /cdcProfileSources/);
  assert.match(profile, /lookupCensusGeography/);
  assert.match(profile, /status: 404/);
  assert.doesNotMatch(profile, /searchParams\.get\("name"\)|safeProfileName/);
  assert.match(profileContract, /vgc8-iyc4/);
  assert.match(profileContract, /kee5-23sr/);
  assert.match(nationalSearch, /layer\.identifier} = '\$\{normalized\}'/);
  assert.match(trends, /xyst-f73f/);
  assert.match(trends, /7cmc-7y5g/);
  assert.match(trends, /d3i6-k6z5/);
  assert.match(report, /Open print-ready brief/);
  assert.match(report, /Save this view/);
  assert.match(report, /sourceManifest/);
  assert.match(report, /response\?\.provenance\.indicators/);
  assert.match(report, /profileEvidenceLabel/);
  assert.match(report, /Source:<\/strong>/);
  assert.match(report, /Vintage or release:/);
  assert.match(dashboard, /className="active-filters"/);
  assert.match(dashboard, /Clear all/);
});

test("includes core accessibility structures and explicit missing-data language", async () => {
  const [dashboard, search, styles] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/GeographySearch.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /className="skip-link"/);
  assert.match(dashboard, /Missing measures stay visible as missing—not zero/);
  assert.match(dashboard, /role="region"/);
  assert.match(search, /role="combobox"/);
  assert.match(search, /role="listbox"/);
  assert.match(search, /aria-activedescendant/);
  assert.match(search, /committedQuery === trimmed/);
  assert.match(search, /setCommittedQuery\(suggestion\.label\)/);
  assert.match(search, /setCommittedQuery\(null\)/);
  assert.match(search, /committedQuery !== query\.trim\(\)/);
  assert.match(search, /body\.partial/);
  assert.match(search, /Retry search/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /prefers-reduced-motion/);
});
