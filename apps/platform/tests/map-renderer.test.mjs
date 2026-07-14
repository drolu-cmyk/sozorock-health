import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { orientBoundaryForD3 } from "../app/lib/map-geometry.ts";

const sourceUrl = new URL("../app/AccessMap.tsx", import.meta.url);
const boundaryUrl = new URL("../public/data/cbcap-boundaries-2025.json", import.meta.url);

test("renders the complete county layer through one accessible canvas", async () => {
  const [source, boundaryText] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(boundaryUrl, "utf8"),
  ]);
  const boundaries = JSON.parse(boundaryText);

  assert.equal(boundaries.counties.length, 3144);
  assert.equal(boundaries.states.length, 51);
  assert.match(source, /<canvas/);
  assert.match(source, /role="img"/);
  assert.match(source, /aria-describedby="county-map-description"/);
  assert.match(source, /data-county-count=\{projected\.counties\.length\}/);
  assert.doesNotMatch(source, /<path\b/);
});

test("keeps canvas interaction, responsive rendering, and accessible alternatives", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /window\.devicePixelRatio/);
  assert.match(source, /ResizeObserver/);
  assert.match(source, /onPointerMove=/);
  assert.match(source, /onClick=/);
  assert.match(source, /onSelect\(county\.record\)/);
  assert.match(source, /Use the geography search or county table for keyboard selection/);
  assert.match(source, /createElement\("canvas"\)/);
  assert.match(source, /getImageData/);
});

test("normalizes Census ring winding without changing the source snapshot", async () => {
  const boundaryText = await readFile(boundaryUrl, "utf8");
  const boundaries = JSON.parse(boundaryText);
  const sample = boundaries.counties.find((county) => county.id === "20195");
  const sourceCoordinates = JSON.stringify(sample.geometry.coordinates);
  const path = geoPath(geoAlbersUsa().scale(1280).translate([487.5, 305]));
  const projected = path(orientBoundaryForD3(sample));

  assert.ok(projected);
  assert.doesNotMatch(projected, /M-94\.9,0\.36L1069\.9/);
  assert.deepEqual(path.centroid(orientBoundaryForD3(sample)).map(Math.round), [431, 299]);
  assert.equal(JSON.stringify(sample.geometry.coordinates), sourceCoordinates);
});
