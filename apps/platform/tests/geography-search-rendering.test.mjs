import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../app/components/GeographySearch.tsx", import.meta.url),
  "utf8",
);

test("renders evidence availability and source vintage from the typed search contract", () => {
  assert.match(source, /GeographySearchResponse/);
  assert.match(source, /VerifiedGeographySuggestion/);
  assert.match(source, /result\.profileSource \?\? result\.source/);
  assert.match(source, /availabilityLabels\[result\.dataAvailability\]/);
  assert.match(source, /Source: \{evidenceSource\.dataset\} · \{evidenceSource\.vintage\}/);
});

test("uses accurate labels for every supported geography and evidence state", () => {
  assert.match(source, /state: "State summary"/);
  assert.match(source, /county: "County"/);
  assert.match(source, /place: "City \/ Census place"/);
  assert.match(source, /locality: "Town \/ county subdivision"/);
  assert.match(source, /zcta: "Census ZCTA"/);
  assert.match(source, /Derived state summary available/);
  assert.match(source, /CDC modeled county estimates available/);
  assert.match(source, /Census geography verified; compatible health estimates unavailable/);
  assert.match(source, /Health-estimate availability checked after selection/);
});
