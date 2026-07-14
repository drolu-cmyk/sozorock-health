"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChartLine, Info } from "@phosphor-icons/react";
import type { GeographyProfile } from "../lib/types";

type Measure = "diabetes" | "highBloodPressure" | "uninsured";
type TrendResponse = {
  county: { fips: string; name: string; state: string };
  releases: Array<{
    year: number;
    dataset: string;
    population: number | null;
    diabetes: number | null;
    highBloodPressure: number | null;
    uninsured: number | null;
  }>;
  partial: boolean;
  source: { label: string; url: string; boundary: string };
};

const measures: { value: Measure; label: string }[] = [
  { value: "diabetes", label: "Diagnosed diabetes" },
  { value: "highBloodPressure", label: "High blood pressure" },
  { value: "uninsured", label: "Adults without insurance" },
];

function pathFor(values: Array<{ year: number; value: number }>, width: number, height: number) {
  if (!values.length) return "";
  const maximum = Math.max(...values.map((item) => item.value), 1);
  const minimum = Math.min(...values.map((item) => item.value), 0);
  const span = Math.max(maximum - minimum, 1);
  return values.map((item, index) => {
    const x = 42 + (index / Math.max(values.length - 1, 1)) * (width - 84);
    const y = height - 38 - ((item.value - minimum) / span) * (height - 76);
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function TrendAnalysis({ profile }: { profile: GeographyProfile | null }) {
  const [measure, setMeasure] = useState<Measure>("diabetes");
  const [data, setData] = useState<TrendResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (profile?.kind !== "county") {
      setData(null);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    void fetch(`/api/trends?fips=${profile.geoid}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Trend comparison unavailable");
        return response.json() as Promise<TrendResponse>;
      })
      .then((body) => {
        setData(body);
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [profile]);

  const series = useMemo(() => data?.releases
    .map((release) => ({ year: release.year, value: release[measure] }))
    .filter((item): item is { year: number; value: number } => item.value !== null) ?? [], [data, measure]);
  const change = series.length >= 2 ? series.at(-1)!.value - series[0].value : null;
  const label = measures.find((candidate) => candidate.value === measure)?.label ?? "Selected measure";
  const width = 700;
  const height = 250;

  return (
    <section className="analysis-panel trend-panel" id="trends" aria-labelledby="trends-heading">
      <header className="panel-heading">
        <div><span>Release comparison</span><h2 id="trends-heading">See how public estimates change across releases.</h2><p>Compare harmonized county fields from CDC PLACES releases while keeping methodological differences visible.</p></div>
        <label><span>Measure</span><select value={measure} onChange={(event) => setMeasure(event.target.value as Measure)}>{measures.map((candidate) => <option key={candidate.value} value={candidate.value}>{candidate.label}</option>)}</select></label>
      </header>
      {!profile || profile.kind !== "county" ? (
        <div className="trend-empty"><ChartLine size={25} aria-hidden="true" /><strong>Select a county to compare releases.</strong><p>City, town, and ZIP-linked profiles remain available elsewhere; this view uses comparable county releases.</p></div>
      ) : status === "loading" ? (
        <div className="trend-empty" role="status"><span className="inline-spinner" />Loading CDC release comparisons…</div>
      ) : status === "error" || !data ? (
        <div className="trend-empty" role="alert"><strong>Release comparisons are temporarily unavailable.</strong><p>The current county profile and planning tools remain available.</p></div>
      ) : (
        <div className="trend-layout">
          <div className="trend-chart">
            <div className="trend-chart__summary"><span>{data.county.name}</span><strong>{change === null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}`}</strong><small>percentage-point change across available releases</small></div>
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} release comparison for ${data.county.name}. ${series.map((item) => `${item.year}: ${item.value.toFixed(1)} percent`).join("; ")}.`}>
              <title>{label} release comparison for {data.county.name}</title>
              {[0, 1, 2, 3].map((line) => <line key={line} x1="42" x2={width - 42} y1={32 + line * 58} y2={32 + line * 58} className="trend-gridline" />)}
              <path d={pathFor(series, width, height)} className="trend-line" />
              {series.map((item, index) => {
                const maximum = Math.max(...series.map((point) => point.value), 1);
                const minimum = Math.min(...series.map((point) => point.value), 0);
                const span = Math.max(maximum - minimum, 1);
                const x = 42 + (index / Math.max(series.length - 1, 1)) * (width - 84);
                const y = height - 38 - ((item.value - minimum) / span) * (height - 76);
                return <g key={item.year}><circle cx={x} cy={y} r="6" className="trend-point"><title>{item.year}: {item.value.toFixed(1)}%</title></circle><text x={x} y={height - 12} textAnchor="middle">{item.year}</text></g>;
              })}
            </svg>
          </div>
          <aside className="trend-table">
            <span>Values by release</span>
            <dl>{data.releases.map((release) => <div key={release.year}><dt>{release.year}</dt><dd>{release[measure] === null ? "Not available" : `${release[measure]!.toFixed(1)}%`}</dd></div>)}</dl>
            <a href={data.source.url} target="_blank" rel="noreferrer">Review CDC PLACES <ArrowUpRight size={14} aria-hidden="true" /></a>
          </aside>
        </div>
      )}
      <p className="panel-source"><Info size={14} aria-hidden="true" /> {data?.source.boundary ?? "Release comparisons are not continuous observations. Confirm definitions and underlying years before drawing conclusions."}</p>
    </section>
  );
}
