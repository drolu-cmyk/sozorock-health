import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  remoteWhereForLayer,
  searchCommittedGeographies,
  searchNationalGeographies,
} from "../app/lib/national-geography-search.ts";
import {
  COMMITTED_GEOGRAPHY_SOURCE_FALLBACK,
  COMMITTED_INDICATOR_SOURCE_FALLBACK,
  TIGERWEB_CURRENT_SOURCE,
} from "../app/lib/geography-provenance.ts";

const states = [
  { fips: "06", name: "California", code: "CA" },
  { fips: "20", name: "Kansas", code: "KS" },
  { fips: "36", name: "New York", code: "NY" },
  { fips: "53", name: "Washington", code: "WA" },
];

const counties = [
  { fips: "06001", stateFips: "06", state: "California", county: "Alameda County", sourceStatus: "available" },
  { fips: "20173", stateFips: "20", state: "Kansas", county: "Sedgwick County", sourceStatus: "available" },
  { fips: "36001", stateFips: "36", state: "New York", county: "Albany County", sourceStatus: "available" },
  { fips: "53033", stateFips: "53", state: "Washington", county: "King County", sourceStatus: "available" },
];

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("returns a provenance-aware committed county result when every TIGERweb layer fails", async () => {
  const result = await searchNationalGeographies({
    term: "06001",
    states,
    counties,
    fetcher: async () => response({ error: { message: "temporarily unavailable" } }, 503),
  });

  assert.equal(result.results[0].id, "county-06001");
  assert.equal(result.results[0].kind, "county");
  assert.equal(result.results[0].label, "Alameda County");
  assert.equal(result.results[0].context, "California · County FIPS 06001");
  assert.deepEqual(result.results[0].identifiers, {
    geoid: "06001",
    stateFips: "06",
    countyFips: "001",
    placeFips: null,
    zcta: null,
  });
  assert.equal(result.results[0].dataAvailability, "official-modeled-estimates-available");
  assert.deepEqual(result.results[0].source, COMMITTED_GEOGRAPHY_SOURCE_FALLBACK);
  assert.equal(result.results[0].profileSource.agency, "Centers for Disease Control and Prevention");
  assert.match(result.results[0].profileSource.method, /Exact county FIPS match/);
  assert.equal(result.partial, true);
  assert.equal(result.remoteUnavailable, true);
});

test("uses an exact county-subdivision query and returns a verified 10-digit locality GEOID", async () => {
  const requestedUrls = [];
  const result = await searchNationalGeographies({
    term: "2017317375",
    states,
    counties,
    fetcher: async (url) => {
      requestedUrls.push(url);
      return response({
        features: [{
          attributes: {
            GEOID: "2017317375",
            STATE: "20",
            NAME: "Delano township",
          },
        }],
      });
    },
  });

  assert.equal(requestedUrls.length, 1);
  const requested = new URL(requestedUrls[0]);
  assert.match(requested.pathname, /\/1\/query$/);
  assert.equal(requested.searchParams.get("where"), "GEOID = '2017317375'");
  assert.equal(result.results[0].id, "locality-2017317375");
  assert.equal(result.results[0].context, "Kansas · Town or county subdivision GEOID 2017317375");
  assert.equal(result.results[0].dataAvailability, "official-geography-only");
  assert.deepEqual(result.results[0].source, TIGERWEB_CURRENT_SOURCE);
  assert.equal(result.results[0].profileSource, null);
  assert.equal(result.partial, false);
  assert.equal(result.remoteUnavailable, false);
});

test("builds layer-appropriate exact and prefix GEOID queries", () => {
  const localityLayer = { kind: "locality", identifier: "GEOID", geoidLength: 10 };
  const placeLayer = { kind: "place", identifier: "GEOID", geoidLength: 7 };
  const zctaLayer = { kind: "zcta", identifier: "ZCTA5", geoidLength: 5 };

  assert.equal(remoteWhereForLayer(localityLayer, "2017317375", states), "GEOID = '2017317375'");
  assert.equal(remoteWhereForLayer(localityLayer, "20173", states), "GEOID LIKE '20173%'");
  assert.equal(remoteWhereForLayer(placeLayer, "2017317", states), "GEOID = '2017317'");
  assert.equal(remoteWhereForLayer(placeLayer, "20173173", states), null);
  assert.equal(remoteWhereForLayer(zctaLayer, "13753", states), "ZCTA5 = '13753'");
  assert.equal(remoteWhereForLayer(zctaLayer, "Seattle, WA", states), null);
});

test("treats a two-digit state FIPS as an exact state without remote fan-out", async () => {
  let remoteCalls = 0;
  const result = await searchNationalGeographies({
    term: "53",
    states,
    counties,
    fetcher: async () => {
      remoteCalls += 1;
      return response({ features: [] });
    },
  });

  assert.equal(remoteCalls, 0);
  assert.deepEqual(result.results.map(({ id }) => id), ["state-53"]);
  assert.equal(result.results[0].dataAvailability, "derived-county-summary-available");
  assert.equal(result.results[0].profileSource.agency, "Centers for Disease Control and Prevention");
  assert.deepEqual(
    { ...result.results[0].profileSource, method: COMMITTED_INDICATOR_SOURCE_FALLBACK.method },
    COMMITTED_INDICATOR_SOURCE_FALLBACK,
  );
  assert.match(result.results[0].profileSource.method, /state summary derived/);
  assert.equal(result.partial, false);
});

test("preserves the committed indicator vintage while distinguishing derived state and exact county evidence", () => {
  const indicatorSource = {
    ...COMMITTED_INDICATOR_SOURCE_FALLBACK,
    dataset: "CDC PLACES County Data",
    vintage: "December 4, 2025",
    refreshedAt: "2026-07-14T00:00:00.000Z",
  };

  const state = searchCommittedGeographies(
    "53",
    states,
    counties,
    COMMITTED_GEOGRAPHY_SOURCE_FALLBACK,
    indicatorSource,
  )[0];
  const county = searchCommittedGeographies(
    "53033",
    states,
    counties,
    COMMITTED_GEOGRAPHY_SOURCE_FALLBACK,
    indicatorSource,
  )[0];

  assert.equal(state.dataAvailability, "derived-county-summary-available");
  assert.equal(county.dataAvailability, "official-modeled-estimates-available");
  assert.equal(state.profileSource.dataset, indicatorSource.dataset);
  assert.equal(county.profileSource.dataset, indicatorSource.dataset);
  assert.equal(state.profileSource.vintage, indicatorSource.vintage);
  assert.equal(county.profileSource.vintage, indicatorSource.vintage);
  assert.match(state.profileSource.method, /state summary derived/);
  assert.match(county.profileSource.method, /Exact county FIPS match/);
});

test("uses state-qualified Census name lookup without sending names to the ZCTA layer", async () => {
  const requestedUrls = [];
  const result = await searchNationalGeographies({
    term: "Seattle, WA",
    states,
    counties,
    fetcher: async (url) => {
      requestedUrls.push(url);
      return url.includes("/4/query")
        ? response({ features: [{ attributes: { GEOID: "5363000", STATE: "53", NAME: "Seattle city" } }] })
        : response({ features: [] });
    },
  });

  assert.equal(requestedUrls.length, 4);
  assert.ok(requestedUrls.every((url) => !url.includes("PUMA_TAD_TAZ_UGA_ZCTA")));
  for (const url of requestedUrls) {
    assert.equal(new URL(url).searchParams.get("where"), "UPPER(BASENAME) LIKE 'SEATTLE%' AND STATE = '53'");
  }
  const seattle = result.results.find(({ id }) => id === "place-5363000");
  assert.ok(seattle);
  assert.equal(seattle.context, "Washington · Incorporated place GEOID 5363000");
  assert.equal(seattle.dataAvailability, "checked-on-selection");
  assert.equal(seattle.identifiers.placeFips, "63000");
  assert.equal(seattle.profileSource, null);
});

test("falls back to the official GNIS populated-place service for Delmar, NY without inventing a health profile", async () => {
  const requestedUrls = [];
  const result = await searchNationalGeographies({
    term: "Delmar, NY",
    states,
    counties,
    fetcher: async (url) => {
      requestedUrls.push(url);
      if (url.includes("dashboard.waterdata.usgs.gov")) {
        return response([
          {
            Source: "gnis",
            Type: "Cities & Populated Places",
            Name: "Delmar",
            County: "Albany County",
            State: "NY",
            GnisId: 948278,
          },
          {
            Source: "gnis",
            Type: "Lakes & Reservoirs",
            Name: "Delmar Reservoir",
            County: "Albany County",
            State: "NY",
            GnisId: 948279,
          },
        ]);
      }
      return response({ features: [] });
    },
  });

  const delmar = result.results.find(({ id }) => id === "community-948278");
  assert.ok(delmar);
  assert.equal(delmar.kind, "community");
  assert.equal(delmar.label, "Delmar");
  assert.match(delmar.context, /New York.*GNIS populated place.*Albany County/);
  assert.equal(/[\u00c2\u00c3\ufffd]/u.test(delmar.context), false);
  assert.equal(delmar.dataAvailability, "official-geography-only");
  assert.equal(delmar.identifiers.gnisId, "948278");
  assert.equal(delmar.profileSource, null);
  assert.match(delmar.source.dataset, /Geographic Names Information System/);
  assert.equal(result.results.some(({ label }) => label === "Delmar Reservoir"), false);
  const gnisUrl = new URL(requestedUrls.find((url) => url.includes("dashboard.waterdata.usgs.gov")));
  assert.equal(gnisUrl.searchParams.get("term"), "DELMAR*");
  assert.equal(gnisUrl.searchParams.get("include"), "gnis");
  assert.equal(result.partial, false);
});

test("queries an exact ZCTA with the layer's valid ordering field", async () => {
  const requestedUrls = [];
  const result = await searchNationalGeographies({
    term: "13753",
    states,
    counties,
    fetcher: async (url) => {
      requestedUrls.push(url);
      return url.includes("PUMA_TAD_TAZ_UGA_ZCTA")
        ? response({ features: [{ attributes: { ZCTA5: "13753", GEOID: "13753", NAME: "13753" } }] })
        : response({ features: [] });
    },
  });

  const zctaRequest = requestedUrls.find((url) => url.includes("PUMA_TAD_TAZ_UGA_ZCTA"));
  assert.ok(zctaRequest);
  const query = new URL(zctaRequest);
  assert.equal(query.searchParams.get("where"), "ZCTA5 = '13753'");
  assert.equal(query.searchParams.get("orderByFields"), "ZCTA5");
  const zcta = result.results.find(({ id }) => id === "zcta-13753");
  assert.ok(zcta);
  assert.equal(zcta.label, "ZIP-linked area 13753");
  assert.equal(zcta.identifiers.zcta, "13753");
  assert.equal(zcta.dataAvailability, "checked-on-selection");
  assert.equal(zcta.profileSource, null);
  assert.equal(result.results[0].id, "zcta-13753");
});

test("ranks an exact ZIP-linked area before numeric GEOID prefixes", async () => {
  const numericCounties = [
    ...counties,
    { fips: "10001", stateFips: "10", state: "Delaware", county: "Kent County", sourceStatus: "available" },
  ];
  const numericStates = [
    ...states,
    { fips: "10", name: "Delaware", code: "DE" },
  ];
  const result = await searchNationalGeographies({
    term: "10001",
    states: numericStates,
    counties: numericCounties,
    fetcher: async (url) => {
      if (url.includes("PUMA_TAD_TAZ_UGA_ZCTA")) {
        return response({ features: [{ attributes: { ZCTA5: "10001", GEOID: "10001", NAME: "10001" } }] });
      }
      if (url.includes("Places_CouSub_ConCity_SubMCD/MapServer/1/query")) {
        return response({ features: [{ attributes: { GEOID: "1000190444", STATE: "10", NAME: "Central Kent CCD" } }] });
      }
      return response({ features: [] });
    },
  });

  assert.deepEqual(result.results.slice(0, 3).map(({ id }) => id), [
    "zcta-10001",
    "county-10001",
    "locality-1000190444",
  ]);
});

test("ranks an exact incorporated place before similarly named subdivisions and counties", async () => {
  const result = await searchNationalGeographies({
    term: "Seattle, WA",
    states,
    counties,
    fetcher: async (url) => {
      if (url.includes("Places_CouSub_ConCity_SubMCD/MapServer/1/query")) {
        return response({ features: [{ attributes: { GEOID: "5303392928", STATE: "53", NAME: "Seattle CCD" } }] });
      }
      if (url.includes("Places_CouSub_ConCity_SubMCD/MapServer/4/query")) {
        return response({ features: [{ attributes: { GEOID: "5363000", STATE: "53", NAME: "Seattle city" } }] });
      }
      return response({ features: [] });
    },
  });

  assert.equal(result.results[0].id, "place-5363000");
  assert.equal(result.results[1].id, "locality-5303392928");
});

test("committed search resolves representative rural, urban, Alaska, D.C., and diacritic geographies", async () => {
  const nationalCounties = JSON.parse(await readFile(
    new URL("../data/county-planning.json", import.meta.url),
    "utf8",
  ));
  const nationalStates = [...new Map(nationalCounties.map((county) => [county.stateFips, {
    fips: county.stateFips,
    name: county.state,
    code: county.stateCode,
  }])).values()];

  assert.equal(nationalCounties.length, 3144);
  assert.equal(nationalStates.length, 51);
  assert.equal(searchCommittedGeographies("Los Angeles, CA", nationalStates, nationalCounties)[0].geoid, "06037");
  assert.equal(searchCommittedGeographies("Delaware County, NY", nationalStates, nationalCounties)[0].geoid, "36025");
  assert.equal(searchCommittedGeographies("Doña Ana, NM", nationalStates, nationalCounties)[0].geoid, "35013");
  assert.equal(searchCommittedGeographies("Aleutians West, AK", nationalStates, nationalCounties)[0].geoid, "02016");
  assert.equal(searchCommittedGeographies("District of Columbia", nationalStates, nationalCounties)[0].geoid, "11");
  assert.equal(searchCommittedGeographies("11001", nationalStates, nationalCounties)[0].geoid, "11001");
});
