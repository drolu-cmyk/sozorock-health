import assert from "node:assert/strict";
import test from "node:test";
import {
  remoteWhereForLayer,
  searchNationalGeographies,
} from "../app/lib/national-geography-search.ts";

const states = [
  { fips: "06", name: "California", code: "CA" },
  { fips: "20", name: "Kansas", code: "KS" },
];

const counties = [
  { fips: "06001", stateFips: "06", state: "California", county: "Alameda County" },
  { fips: "20173", stateFips: "20", state: "Kansas", county: "Sedgwick County" },
];

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("returns a committed county result when every TIGERweb layer fails", async () => {
  const result = await searchNationalGeographies({
    term: "06001",
    states,
    counties,
    fetcher: async () => response({ error: { message: "temporarily unavailable" } }, 503),
  });

  assert.deepEqual(result.results[0], {
    id: "county-06001",
    kind: "county",
    label: "Alameda County",
    context: "California · County FIPS 06001",
    geoid: "06001",
    stateFips: "06",
  });
  assert.equal(result.partial, true);
  assert.equal(result.remoteUnavailable, true);
});

test("uses an exact county-subdivision query and returns a valid 10-digit locality GEOID", async () => {
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
  assert.deepEqual(result.results, [{
    id: "locality-2017317375",
    kind: "locality",
    label: "Delano township",
    context: "Kansas · Town or county subdivision GEOID 2017317375",
    geoid: "2017317375",
    stateFips: "20",
  }]);
  assert.equal(result.partial, false);
  assert.equal(result.remoteUnavailable, false);
});

test("builds layer-appropriate exact and prefix GEOID queries", () => {
  const localityLayer = {
    identifier: "GEOID",
    geoidLength: 10,
  };
  const placeLayer = {
    identifier: "GEOID",
    geoidLength: 7,
  };
  const zctaLayer = {
    identifier: "ZCTA5",
    geoidLength: 5,
  };

  assert.equal(remoteWhereForLayer(localityLayer, "2017317375", states), "GEOID = '2017317375'");
  assert.equal(remoteWhereForLayer(localityLayer, "20173", states), "GEOID LIKE '20173%'");
  assert.equal(remoteWhereForLayer(placeLayer, "2017317", states), "GEOID = '2017317'");
  assert.equal(remoteWhereForLayer(placeLayer, "20173173", states), null);
  assert.equal(remoteWhereForLayer(zctaLayer, "13753", states), "ZCTA5 = '13753'");
});
