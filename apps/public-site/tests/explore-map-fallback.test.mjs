import assert from "node:assert/strict";
import test from "node:test";
import {
  collectionPolygons,
  compoundPathForPolygons,
  fitFallbackGeometry,
  hasRenderableGeometry,
  projectFallbackPosition,
} from "../app/lib/explore-map-fallback.ts";

const featureCollection = (geometry) => ({ type: "FeatureCollection", features: [{ geometry }] });

test("Fairfax County MultiPolygon preserves interior rings in one even-odd compound path", () => {
  const fairfax = featureCollection({
    type: "MultiPolygon",
    coordinates: [
      [
        [[-77.2, 38.8], [-77.1, 38.8], [-77.1, 39], [-77.2, 39], [-77.2, 38.8]],
        [[-77.17, 38.86], [-77.14, 38.86], [-77.14, 38.9], [-77.17, 38.9], [-77.17, 38.86]],
      ],
      [[[-77.05, 38.8], [-77, 38.8], [-77, 38.85], [-77.05, 38.85], [-77.05, 38.8]]],
    ],
  });
  const polygons = collectionPolygons(fairfax);
  const layout = fitFallbackGeometry([fairfax]);
  assert.equal(polygons.length, 2);
  assert.equal(polygons[0].length, 2, "the first Fairfax polygon retains its hole ring");
  const path = compoundPathForPolygons(polygons, layout);
  assert.equal((path.match(/\bM/g) ?? []).length, 3);
  assert.equal((path.match(/\bZ/g) ?? []).length, 3);
});

test("fallback fitting uses one scale and letterboxes narrow and wide counties", () => {
  const narrow = featureCollection({
    type: "Polygon",
    coordinates: [[[-75, 38], [-74.98, 38], [-74.98, 39], [-75, 39], [-75, 38]]],
  });
  const wide = featureCollection({
    type: "Polygon",
    coordinates: [[[-100, 38], [-95, 38], [-95, 38.1], [-100, 38.1], [-100, 38]]],
  });
  const narrowLayout = fitFallbackGeometry([narrow]);
  const wideLayout = fitFallbackGeometry([wide]);
  assert.ok(narrowLayout && wideLayout);
  assert.ok(narrowLayout.offsetX > 0, "narrow geometry gets horizontal letterboxing");
  assert.ok(wideLayout.offsetY > 0, "wide geometry gets vertical letterboxing");
  const narrowStart = projectFallbackPosition([-75, 38], narrowLayout);
  const narrowEnd = projectFallbackPosition([-74.98, 39], narrowLayout);
  const width = Math.abs(narrowEnd[0] - narrowStart[0]);
  const height = Math.abs(narrowEnd[1] - narrowStart[1]);
  assert.ok(height > width * 10, "narrow county remains visibly elongated");
});

test("fallback can render an original ZIP or place context without changing county evidence scope", () => {
  const county = featureCollection({
    type: "Polygon",
    coordinates: [[[-75.2, 39.8], [-75, 39.8], [-75, 40], [-75.2, 40], [-75.2, 39.8]]],
  });
  const zip19104 = featureCollection({
    type: "Polygon",
    coordinates: [[[-75.18, 39.9], [-75.08, 39.9], [-75.08, 39.98], [-75.18, 39.98], [-75.18, 39.9]]],
  });
  const layout = fitFallbackGeometry([county, zip19104]);
  const contextPath = compoundPathForPolygons(collectionPolygons(zip19104), layout);
  assert.equal(hasRenderableGeometry(zip19104), true);
  assert.ok(contextPath.includes("M"), "ZIP 19104 context has a visible outline path");
  assert.ok(layout.offsetX >= 0 && layout.offsetY >= 0);
});

test("context geometry without a polygon does not claim to be visible", () => {
  const emptyContext = { type: "FeatureCollection", features: [{ geometry: { type: "Point", coordinates: [-75, 40] } }] };
  assert.equal(hasRenderableGeometry(emptyContext), false);
});
