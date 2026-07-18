type Position = number[];
type Ring = Position[];

type RenderFeature = {
  geometry?: {
    type?: string;
    coordinates?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2 && value.every((item) => typeof item === "number");
}

function isRing(value: unknown): value is Ring {
  return Array.isArray(value) && value.every(isPosition);
}

function signedRingArea(ring: Ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function orientRing(ring: Ring, clockwise: boolean) {
  const isClockwise = signedRingArea(ring) < 0;
  return isClockwise === clockwise ? ring : [...ring].reverse();
}

function orientPolygon(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map((ring, index) =>
    isRing(ring) ? orientRing(ring, index === 0) : ring,
  );
}

/** Normalize a render-only copy for d3 without changing the source response. */
export function orientBoundaryForD3<T extends RenderFeature>(feature: T): T {
  const geometry = feature.geometry;
  if (!geometry) return feature;
  const coordinates = geometry.type === "Polygon"
    ? orientPolygon(geometry.coordinates)
    : geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)
      ? geometry.coordinates.map(orientPolygon)
      : geometry.coordinates;
  return { ...feature, geometry: { ...geometry, coordinates } } as T;
}
