"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { formatOrdinal } from "./lib/metrics";
import { orientBoundaryForD3 } from "./lib/map-geometry";
import type { MapCountyRecord, MetricKey } from "./lib/types";

type BoundaryFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, {
  fips: string;
  stateFips?: string;
  name: string;
}>;

type BoundarySnapshot = {
  vintage: string;
  source: string;
  counties: BoundaryFeature[];
  states: BoundaryFeature[];
};

type LayerKey = Extract<
  MetricKey,
  | "planningPressure"
  | "chronicPercentile"
  | "barrierPercentile"
  | "preventionOpportunityPercentile"
  | "diabetes"
  | "highBloodPressure"
  | "uninsured"
  | "transportation"
  | "dataCoverage"
>;

type Tip = {
  x: number;
  y: number;
  record: MapCountyRecord;
  value: number | null;
} | null;

type ProjectedCounty = {
  path: Path2D;
  record: MapCountyRecord;
};

type MapTransform = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

const MAP_WIDTH = 975;
const MAP_HEIGHT = 610;
const HIT_SCALE = 2;

const layerLabels: Record<LayerKey, string> = {
  planningPressure: "Planning attention",
  chronicPercentile: "Chronic-condition pressure",
  barrierPercentile: "Barrier pressure",
  preventionOpportunityPercentile: "Prevention opportunity",
  diabetes: "Diagnosed diabetes",
  highBloodPressure: "High blood pressure",
  uninsured: "Adults without health insurance",
  transportation: "Lack of reliable transportation",
  dataCoverage: "Data coverage",
};

const percentileLayers = new Set<LayerKey>([
  "planningPressure",
  "chronicPercentile",
  "barrierPercentile",
  "preventionOpportunityPercentile",
]);

function layerValue(record: MapCountyRecord, layer: LayerKey) {
  if (layer === "planningPressure") return record.planningPressure;
  if (layer === "chronicPercentile") return record.chronicPercentile;
  if (layer === "barrierPercentile") return record.barrierPercentile;
  if (layer === "preventionOpportunityPercentile") return record.preventionOpportunityPercentile;
  return record[layer];
}

function quantile(sorted: number[], percentile: number) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function formatValue(value: number | null, layer: LayerKey) {
  if (value === null) return "Not available";
  if (layer === "dataCoverage") return `${Math.round(value)}% covered`;
  if (percentileLayers.has(layer)) return `${formatOrdinal(value)} percentile`;
  return `${value.toFixed(1)}%`;
}

function formatLegendRange(from: number, to: number, layer: LayerKey) {
  if (percentileLayers.has(layer)) {
    return `${formatOrdinal(Math.round(from))}–${formatOrdinal(Math.round(to))}`;
  }
  return `${Math.round(from)}–${Math.round(to)}%`;
}

function mapTransform(width: number, height: number): MapTransform {
  const scale = Math.min(width / MAP_WIDTH, height / MAP_HEIGHT);
  return {
    scale,
    offsetX: (width - MAP_WIDTH * scale) / 2,
    offsetY: (height - MAP_HEIGHT * scale) / 2,
  };
}

function hitColor(index: number) {
  const value = index + 1;
  return `rgb(${value & 255}, ${(value >> 8) & 255}, ${(value >> 16) & 255})`;
}

function hitIndex(red: number, green: number, blue: number) {
  return red + (green << 8) + (blue << 16) - 1;
}

export type { LayerKey };

export default function AccessMap({
  records,
  includedFips,
  layer,
  selectedFips,
  selectedStateFips,
  onSelect,
}: {
  records: MapCountyRecord[];
  includedFips: Set<string>;
  layer: LayerKey;
  selectedFips: string | null;
  selectedStateFips: string;
  onSelect: (record: MapCountyRecord) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitRecordsRef = useRef<ProjectedCounty[]>([]);
  const [tip, setTip] = useState<Tip>(null);
  const [boundaries, setBoundaries] = useState<BoundarySnapshot | null>(null);
  const [boundaryStatus, setBoundaryStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/data/cbcap-boundaries-2025.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Boundary snapshot unavailable");
        return response.json() as Promise<BoundarySnapshot>;
      })
      .then((snapshot) => {
        if (snapshot.counties.length !== 3144 || snapshot.states.length !== 51) {
          throw new Error("Boundary snapshot is incomplete");
        }
        setBoundaries(snapshot);
        setBoundaryStatus("ready");
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setBoundaryStatus("error");
      });
    return () => controller.abort();
  }, []);

  const path = useMemo(() => {
    const projection = geoAlbersUsa().scale(1280).translate([487.5, 305]);
    return geoPath(projection);
  }, []);
  const byFips = useMemo(() => new Map(records.map((record) => [record.fips, record])), [records]);
  const availableValues = useMemo(
    () => records
      .filter((record) => includedFips.has(record.fips))
      .map((record) => layerValue(record, layer))
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b),
    [includedFips, layer, records],
  );
  const thresholds = useMemo(
    () => [0.2, 0.4, 0.6, 0.8].map((position) => quantile(availableValues, position)),
    [availableValues],
  );
  const colors = useMemo(
    () => layer === "dataCoverage"
      ? ["#e9ece4", "#cdd8c2", "#9fb38a", "#6f8c59", "#365f48"]
      : ["#efe9dc", "#ddc9a3", "#c79b57", "#a86543", "#733b35"],
    [layer],
  );
  const colorFor = useCallback((value: number | null) => {
    if (value === null) return "#e7e8e2";
    const index = thresholds.findIndex((threshold) => value <= threshold);
    return colors[index === -1 ? colors.length - 1 : index];
  }, [colors, thresholds]);
  const legendRanges = [
    { from: availableValues[0] ?? 0, to: thresholds[0] ?? 0 },
    { from: thresholds[0] ?? 0, to: thresholds[1] ?? 0 },
    { from: thresholds[1] ?? 0, to: thresholds[2] ?? 0 },
    { from: thresholds[2] ?? 0, to: thresholds[3] ?? 0 },
    { from: thresholds[3] ?? 0, to: availableValues.at(-1) ?? 0 },
  ];

  const rendererSupported = typeof Path2D !== "undefined";
  const projected = useMemo(() => {
    if (!boundaries || !rendererSupported) return { counties: [] as ProjectedCounty[], states: [] as Path2D[] };
    const counties = boundaries.counties.flatMap((geometry) => {
      const fips = String(geometry.id ?? geometry.properties.fips).padStart(5, "0");
      const record = byFips.get(fips);
      const data = path(orientBoundaryForD3(geometry));
      return record && data ? [{ path: new Path2D(data), record }] : [];
    });
    const states = boundaries.states.flatMap((geometry) => {
      const data = path(orientBoundaryForD3(geometry));
      return data ? [new Path2D(data)] : [];
    });
    return { counties, states };
  }, [boundaries, byFips, path, rendererSupported]);

  useEffect(() => {
    if (projected.counties.length !== 3144) return;
    const hitCanvas = document.createElement("canvas");
    hitCanvas.width = MAP_WIDTH * HIT_SCALE;
    hitCanvas.height = MAP_HEIGHT * HIT_SCALE;
    const context = hitCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.save();
    context.scale(HIT_SCALE, HIT_SCALE);
    projected.counties.forEach((county, index) => {
      context.fillStyle = hitColor(index);
      context.fill(county.path);
    });
    context.restore();
    hitCanvasRef.current = hitCanvas;
    hitRecordsRef.current = projected.counties;
    return () => {
      hitCanvasRef.current = null;
      hitRecordsRef.current = [];
    };
  }, [projected.counties]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || projected.counties.length !== 3144) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
    const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const transform = mapTransform(rect.width, rect.height);
    context.translate(transform.offsetX, transform.offsetY);
    context.scale(transform.scale, transform.scale);
    context.lineJoin = "round";
    context.lineCap = "round";

    projected.counties.forEach(({ path: countyPath, record }) => {
      const value = layerValue(record, layer);
      const muted = !includedFips.has(record.fips)
        || Boolean(selectedStateFips && record.stateFips !== selectedStateFips);
      context.globalAlpha = muted ? 0.12 : 1;
      context.fillStyle = colorFor(value);
      context.fill(countyPath);
      context.strokeStyle = "#fffdf8";
      context.lineWidth = 0.28;
      context.stroke(countyPath);
    });

    context.globalAlpha = 1;
    context.strokeStyle = "#4e5d55";
    context.lineWidth = 0.75;
    projected.states.forEach((statePath) => context.stroke(statePath));

    const hoverFips = tip?.record.fips ?? null;
    const emphasisFips = [hoverFips, selectedFips].filter((fips, index, values): fips is string => Boolean(fips) && values.indexOf(fips) === index);
    emphasisFips.forEach((fips) => {
      const county = projected.counties.find((candidate) => candidate.record.fips === fips);
      if (!county) return;
      const muted = !includedFips.has(fips)
        || Boolean(selectedStateFips && county.record.stateFips !== selectedStateFips);
      context.globalAlpha = muted ? 0.24 : 1;
      context.strokeStyle = fips === selectedFips ? "#071e18" : "#234d3d";
      context.lineWidth = fips === selectedFips ? 2.4 : 1.6;
      context.stroke(county.path);
    });
    context.globalAlpha = 1;
  }, [colorFor, includedFips, layer, projected.counties, projected.states, selectedFips, selectedStateFips, tip?.record.fips]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || projected.counties.length !== 3144) return;
    let frame = 0;
    const requestDraw = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(draw);
    };
    requestDraw();
    const observer = new ResizeObserver(requestDraw);
    observer.observe(canvas);
    window.addEventListener("resize", requestDraw);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", requestDraw);
    };
  }, [draw, projected.counties.length]);

  const countyAtPointer = useCallback((clientX: number, clientY: number, scanOnMiss = false) => {
    const canvas = canvasRef.current;
    const hitCanvas = hitCanvasRef.current;
    if (!canvas || !hitCanvas) return null;
    const rect = canvas.getBoundingClientRect();
    const transform = mapTransform(rect.width, rect.height);
    const x = (clientX - rect.left - transform.offsetX) / transform.scale;
    const y = (clientY - rect.top - transform.offsetY) / transform.scale;
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
    const context = hitCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    const pixel = context.getImageData(
      Math.min(hitCanvas.width - 1, Math.max(0, Math.floor(x * HIT_SCALE))),
      Math.min(hitCanvas.height - 1, Math.max(0, Math.floor(y * HIT_SCALE))),
      1,
      1,
    ).data;
    const index = hitIndex(pixel[0], pixel[1], pixel[2]);
    const county = hitRecordsRef.current[index];
    if (county) return county;
    if (!scanOnMiss) return null;
    return hitRecordsRef.current.find((candidate) => context.isPointInPath(candidate.path, x, y)) ?? null;
  }, []);

  if (boundaryStatus === "loading") {
    return <div className="map-skeleton" role="status"><span />Loading the current Census county map…</div>;
  }
  if (boundaryStatus === "error" || !boundaries || !rendererSupported || projected.counties.length !== 3144) {
    return (
      <div className="map-error" role="alert">
        <strong>The map boundary layer is temporarily unavailable.</strong>
        <p>Use geography search or the county explorer; all profiles and planning tools remain available.</p>
      </div>
    );
  }

  const selectedCounty = selectedFips ? byFips.get(selectedFips) : null;
  const mapDescription = `Every county equivalent is shown. Counties outside the current filters are muted; counties without a value use a neutral fill. Alaska and Hawaii appear in the standard inset positions.${selectedCounty ? ` ${selectedCounty.county}, ${selectedCounty.state} is selected.` : ""}`;

  return (
    <div className="national-map" data-testid="county-choropleth" data-renderer="canvas" data-county-count={projected.counties.length}>
      <canvas
        ref={canvasRef}
        className={`map-canvas${tip ? " is-interactive" : ""}`}
        role="img"
        aria-label={`United States county map showing ${layerLabels[layer]}. Use the geography search or county table for keyboard selection.`}
        aria-describedby="county-map-description"
        onPointerMove={(event) => {
          const county = countyAtPointer(event.clientX, event.clientY);
          const box = event.currentTarget.getBoundingClientRect();
          if (!county || !box.width || !box.height) {
            setTip(null);
            return;
          }
          setTip({
            x: ((event.clientX - box.left) / box.width) * 100,
            y: ((event.clientY - box.top) / box.height) * 100,
            record: county.record,
            value: layerValue(county.record, layer),
          });
        }}
        onPointerLeave={() => setTip(null)}
        onClick={(event) => {
          const county = countyAtPointer(event.clientX, event.clientY, true);
          if (county) onSelect(county.record);
        }}
      >
        United States county map showing {layerLabels[layer]}. Use geography search or the county table to select a county.
      </canvas>
      <p id="county-map-description" className="sr-only">{mapDescription}</p>
      <div className="map-legend" role="group" aria-label={`${layerLabels[layer]} map legend`}>
        <strong>{layerLabels[layer]}</strong>
        <div>
          {availableValues.length ? legendRanges.map((range, index) => (
              <span key={`${range.from}-${range.to}-${index}`}>
                <i style={{ background: colors[index] }} aria-hidden="true" />
                {formatLegendRange(range.from, range.to, layer)}
              </span>
            )) : <span>No matching county values</span>}
          <span><i className="no-data" aria-hidden="true" />No data</span>
        </div>
      </div>
      {tip && (
        <div
          className="map-tooltip"
          style={{
            left: `${Math.min(Math.max(tip.x + 1.5, 3), 72)}%`,
            top: `${Math.min(Math.max(tip.y + 1.5, 3), 78)}%`,
          }}
          role="status"
        >
          <strong>{tip.record.county}</strong>
          <span>{tip.record.state} · FIPS {tip.record.fips}</span>
          <b>{formatValue(tip.value, layer)}</b>
          <small>Click for the county system portrait</small>
        </div>
      )}
    </div>
  );
}
