export type FallbackPosition = readonly [number, number, ...number[]];
export type FallbackRing = readonly FallbackPosition[];
export type FallbackPolygon = readonly FallbackRing[];

export type FallbackGeometry = {
  type?: string;
  coordinates?: unknown;
};

export type FallbackFeature = { geometry?: FallbackGeometry | null };
export type FallbackCollection = { features?: readonly FallbackFeature[] };

export type FallbackLayout = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  latitudeScale: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

function isPosition(value: unknown): value is FallbackPosition {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === "number"
    && typeof value[1] === "number";
}

function isRing(value: unknown): value is FallbackRing {
  return Array.isArray(value) && value.length >= 3 && value.every(isPosition);
}

function polygonCoordinates(value: unknown): FallbackPolygon[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  if (value.every(isRing)) return [value as FallbackPolygon];
  return value.flatMap((item) => polygonCoordinates(item));
}

export function featurePolygons(feature: FallbackFeature): FallbackPolygon[] {
  const geometry = feature.geometry;
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return [];
  return polygonCoordinates(geometry.coordinates);
}

export function collectionPolygons(collection: FallbackCollection | null | undefined): FallbackPolygon[] {
  return (collection?.features ?? []).flatMap(featurePolygons);
}

export function hasRenderableGeometry(collection: FallbackCollection | null | undefined) {
  return collectionPolygons(collection).length > 0;
}

function positions(polygons: readonly FallbackPolygon[]) {
  return polygons.flatMap((polygon) => polygon.flatMap((ring) => [...ring]));
}

/** Fit longitude/latitude coordinates to a square SVG while preserving one shared scale. */
export function fitFallbackGeometry(
  collections: readonly (FallbackCollection | null | undefined)[],
  padding = 6,
): FallbackLayout | null {
  const points = collections.flatMap((collection) => positions(collectionPolygons(collection)));
  if (!points.length) return null;
  const minX = Math.min(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxX = Math.max(...points.map(([x]) => x));
  const maxY = Math.max(...points.map(([, y]) => y));
  // Equirectangular local correction keeps east/west distances visually honest at the county latitude.
  const centerLatitude = (minY + maxY) / 2;
  const latitudeScale = Math.max(Math.cos((centerLatitude * Math.PI) / 180), 0.1);
  const projectedWidth = Math.max((maxX - minX) * latitudeScale, 0.000001);
  const projectedHeight = Math.max(maxY - minY, 0.000001);
  const scale = Math.min((100 - padding * 2) / projectedWidth, (100 - padding * 2) / projectedHeight);
  const offsetX = (100 - projectedWidth * scale) / 2;
  const offsetY = (100 - projectedHeight * scale) / 2;
  return { minX, minY, maxX, maxY, latitudeScale, scale, offsetX, offsetY };
}

export function projectFallbackPosition(position: FallbackPosition, layout: FallbackLayout) {
  const x = layout.offsetX + (position[0] - layout.minX) * layout.latitudeScale * layout.scale;
  const y = 100 - (layout.offsetY + (position[1] - layout.minY) * layout.scale);
  return [x, y] as const;
}

export function compoundPathForPolygons(polygons: readonly FallbackPolygon[], layout: FallbackLayout) {
  return polygons.map((polygon) => polygon.map((ring) => {
    const points = ring.map((position, index) => {
      const [x, y] = projectFallbackPosition(position, layout);
      return `${index === 0 ? "M" : "L"}${x.toFixed(3)} ${y.toFixed(3)}`;
    }).join(" ");
    return `${points} Z`;
  }).join(" ")).join(" ");
}
