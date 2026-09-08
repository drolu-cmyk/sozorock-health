import assert from "node:assert/strict";
import test from "node:test";
import { readExploreState, exploreStateUrl, csvCell } from "../app/lib/explore-view-state.ts";
test("a shared map view retains county resolution and selected measure but omits arbitrary inputs", () => {
  const state=readExploreState(new URLSearchParams("kind=zip&geoid=12207&county=36001&view=map&measure=access2&email=private@example.com&query=private"));
  assert.equal(exploreStateUrl(state), "/explore?kind=zip&geoid=12207&view=map&county=36001&measure=access2");
});
test("unsupported geography and invalid identifiers cannot initialize a data request", () => {
  for (const query of ["kind=state&geoid=36", "kind=county&geoid=bad", "kind=place&geoid=36001"]) assert.equal(readExploreState(new URLSearchParams(query)), null);
});
test("CSV preserves numeric zero and missing values and neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell(0), '"0"'); assert.equal(csvCell(null), '""');
  assert.equal(csvCell('=1+2'), '"\'=1+2"'); assert.equal(csvCell(-1.2), '"-1.2"');
  assert.equal(csvCell('A "quote"'), '"A ""quote"""');
});
