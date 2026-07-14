import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildProfileProvenance } from "../app/lib/profile-provenance.ts";

const manifest = JSON.parse(await readFile(
  new URL("../data/source-manifest.json", import.meta.url),
  "utf8",
));

function profile(kind, sourceStatus, planningPressure = null) {
  return {
    kind,
    geoid: "00000",
    name: "Test geography",
    context: "Test context",
    stateFips: "",
    population: null,
    adultPopulation: null,
    conditions: {},
    barriers: {},
    prevention: {},
    dataCoverage: sourceStatus === "available" ? 100 : 0,
    sourceStatus,
    planning: {
      chronicPercentile: null,
      barrierPercentile: null,
      preventionOpportunityPercentile: null,
      planningPressure,
    },
  };
}

test("county and state profiles distinguish source estimates from derived summaries", () => {
  const county = buildProfileProvenance({
    kind: "county",
    profile: profile("county", "available", 72),
    manifest,
  });
  const state = buildProfileProvenance({
    kind: "state",
    profile: profile("state", "available", 61),
    manifest,
  });

  assert.equal(county.evidenceStatus, "official-source-estimates");
  assert.match(county.indicators.method, /Exact county FIPS match/);
  assert.equal(state.evidenceStatus, "derived-official-source-estimates");
  assert.match(state.indicators.method, /Population-weighted state summary/);
  assert.equal(county.planning.classification, "demonstration-model");
  assert.equal(county.planning.available, true);
  assert.match(county.planning.boundary, /Not a government designation/);
});

test("subcounty profiles fail closed when compatible health indicators are absent", () => {
  const locality = buildProfileProvenance({
    kind: "locality",
    profile: profile("locality", "not-available"),
    manifest,
    censusSourceUrl: "https://tigerweb.geo.census.gov/example",
  });
  const zcta = buildProfileProvenance({
    kind: "zcta",
    profile: profile("zcta", "not-available"),
    manifest,
  });

  assert.equal(locality.evidenceStatus, "official-geography-only");
  assert.equal(locality.indicators, null);
  assert.equal(locality.geography.url, "https://tigerweb.geo.census.gov/example");
  assert.ok(locality.limitations.some((note) => note.includes("have not been inferred")));
  assert.ok(zcta.limitations.some((note) => note.includes("not a USPS delivery route")));
  assert.equal(zcta.planning.available, false);
});

test("place and ZCTA profiles cite their exact on-demand CDC datasets", () => {
  const place = buildProfileProvenance({
    kind: "place",
    profile: profile("place", "available", 55),
    manifest,
  });
  const zcta = buildProfileProvenance({
    kind: "zcta",
    profile: profile("zcta", "available", 49),
    manifest,
  });

  assert.match(place.indicators.url, /vgc8-iyc4$/);
  assert.match(zcta.indicators.url, /kee5-23sr$/);
  assert.match(place.limitations.join(" "), /may cross county boundaries/);
  assert.equal(place.evidenceStatus, "official-source-estimates");
});

test("GNIS communities remain geography-only and never inherit county evidence", () => {
  const community = buildProfileProvenance({
    kind: "community",
    profile: profile("community", "not-available"),
    manifest,
    gnisSourceUrl: "https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/3",
  });

  assert.equal(community.evidenceStatus, "official-geography-only");
  assert.equal(community.indicators, null);
  assert.match(community.geography.dataset, /Geographic Names Information System/);
  assert.match(community.geography.url, /geonames\/MapServer\/3$/);
  assert.ok(community.limitations.some((note) => note.includes("does not define a Census statistical boundary")));
  assert.equal(community.planning.available, false);
});
