import assert from "node:assert/strict";
import test from "node:test";
import { lookupGnisCommunity } from "../app/lib/gnis-geography.ts";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("verifies an exact GNIS populated-place identifier", async () => {
  let requestUrl = "";
  const result = await lookupGnisCommunity("948278", async (url) => {
    requestUrl = url;
    return response({
      features: [{
        attributes: {
          gaz_id: 948278,
          gaz_name: "Delmar",
          gaz_featureclass: "Populated Place",
          state_alpha: "NY",
          county_name: "Albany",
        },
      }],
    });
  });

  assert.deepEqual(result, {
    status: "found",
    gnisId: "948278",
    name: "Delmar",
    stateCode: "NY",
    countyName: "Albany",
    sourceUrl: "https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/3",
  });
  const query = new URL(requestUrl);
  assert.equal(query.searchParams.get("where"), "gaz_id = 948278");
  assert.equal(query.searchParams.get("returnGeometry"), "false");
});

test("rejects a GNIS feature that is not a populated place", async () => {
  const result = await lookupGnisCommunity("948279", async () => response({
    features: [{
      attributes: {
        gaz_id: 948279,
        gaz_name: "Delmar Reservoir",
        gaz_featureclass: "Reservoir",
        state_alpha: "NY",
        county_name: "Albany",
      },
    }],
  }));
  assert.deepEqual(result, { status: "not-found" });
});

test("fails closed when the GNIS validation service is unavailable", async () => {
  const result = await lookupGnisCommunity("948278", async () => response({}, 503));
  assert.deepEqual(result, { status: "unavailable" });
});
