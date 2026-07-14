import assert from "node:assert/strict";
import test from "node:test";
import { lookupCensusGeography } from "../app/lib/census-geography.ts";

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("resolves an exact place GEOID to the authoritative Census name", async () => {
  const result = await lookupCensusGeography("place", "0811810", async (url) => (
    url.includes("/4/query")
      ? response({ features: [{ attributes: { GEOID: "0811810", STATE: "08", NAME: "Cañon City city" } }] })
      : response({ features: [] })
  ));

  assert.deepEqual(result, {
    status: "found",
    name: "Cañon City city",
    stateFips: "08",
    contextLabel: "Census place",
    sourceUrl: "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4",
  });
});

test("returns not-found only when every authoritative layer answers without a match", async () => {
  const result = await lookupCensusGeography(
    "locality",
    "0600199999",
    async () => response({ features: [] }),
  );
  assert.deepEqual(result, { status: "not-found" });
});

test("fails closed when a required Census layer is unavailable and no layer finds the GEOID", async () => {
  const result = await lookupCensusGeography("place", "0699999", async (url) => (
    url.includes("/4/query")
      ? response({ features: [] })
      : response({ error: { message: "temporary" } })
  ));
  assert.deepEqual(result, { status: "unavailable" });
});

test("verifies a ZCTA and uses the bounded ZIP-linked label", async () => {
  const result = await lookupCensusGeography("zcta", "13753", async () => response({
    features: [{ attributes: { ZCTA5: "13753", GEOID: "13753", NAME: "13753" } }],
  }));
  assert.equal(result.status, "found");
  if (result.status === "found") {
    assert.equal(result.name, "ZIP-linked area 13753");
    assert.equal(result.stateFips, "");
    assert.match(result.sourceUrl, /PUMA_TAD_TAZ_UGA_ZCTA/);
  }
});
