type CountyGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

function signedRingArea(ring: GeoJSON.Position[]) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function orientRing(ring: GeoJSON.Position[], clockwise: boolean) {
  const isClockwise = signedRingArea(ring) < 0;
  return isClockwise === clockwise ? ring : [...ring].reverse();
}

function orientPolygon(rings: GeoJSON.Position[][]) {
  return rings.map((ring, index) => orientRing(ring, index === 0));
}

/**
 * d3-geo uses clockwise exterior rings for spherical polygons. Census geometry
 * follows RFC 7946's counter-clockwise convention, so normalize a render-only
 * copy while preserving the authoritative source snapshot unchanged.
 */
export function orientBoundaryForD3<T extends GeoJSON.Feature<CountyGeometry>>(feature: T): T {
  const geometry = feature.geometry.type === "Polygon"
    ? { ...feature.geometry, coordinates: orientPolygon(feature.geometry.coordinates) }
    : { ...feature.geometry, coordinates: feature.geometry.coordinates.map(orientPolygon) };
  return { ...feature, geometry } as T;
}
