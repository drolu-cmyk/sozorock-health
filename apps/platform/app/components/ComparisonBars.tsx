"use client";

import type {
  BenchmarkProfile,
  GeographyProfile,
  MetricDefinition,
} from "../lib/types";
import { indicatorValue } from "../lib/metrics";
import sourceManifest from "../../data/source-manifest.json";

function benchmarkValue(benchmark: BenchmarkProfile | null, metric: MetricDefinition) {
  if (!benchmark) return null;
  if (metric.group === "condition") {
    return benchmark.conditions[metric.key as keyof BenchmarkProfile["conditions"]];
  }
  if (metric.group === "barrier") {
    return benchmark.barriers[metric.key as keyof BenchmarkProfile["barriers"]];
  }
  if (metric.group === "prevention") {
    return benchmark.prevention[metric.key as keyof BenchmarkProfile["prevention"]];
  }
  return null;
}

export function ComparisonBars({
  profile,
  stateBenchmark,
  nationalBenchmark,
  metrics,
  title,
  description,
}: {
  profile: GeographyProfile | null;
  stateBenchmark: BenchmarkProfile | null;
  nationalBenchmark: BenchmarkProfile;
  metrics: MetricDefinition[];
  title: string;
  description: string;
}) {
  const isNationalOverview = profile === null;
  const selectedLabel = profile?.name ?? "National county benchmark";
  return (
    <section className="analysis-panel comparison-panel" aria-labelledby={`${title.replaceAll(" ", "-").toLowerCase()}-heading`}>
      <header className="panel-heading">
        <div>
          <span>Comparative evidence</span>
          <h2 id={`${title.replaceAll(" ", "-").toLowerCase()}-heading`}>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="comparison-key" role="group" aria-label="Comparison key">
          <span><i className="selected" />{selectedLabel}</span>
          {stateBenchmark && <span><i className="state" />{stateBenchmark.name}</span>}
          {!isNationalOverview && <span><i className="national" />National benchmark</span>}
        </div>
      </header>
      <div className="comparison-bars">
        {metrics.map((metric) => {
          const selected = profile
            ? indicatorValue(profile, metric.key)
            : benchmarkValue(nationalBenchmark, metric);
          const state = benchmarkValue(stateBenchmark, metric);
          const national = benchmarkValue(nationalBenchmark, metric);
          return (
            <div className="comparison-row" key={metric.key}>
              <div className="comparison-row__label">
                <strong>{metric.shortLabel}</strong>
                <span>{selected === null ? "Not available" : `${selected.toFixed(1)}%`}</span>
              </div>
              <div
                className="comparison-track"
                role="img"
                aria-label={`${metric.label}. ${selectedLabel}: ${selected === null ? "not available" : `${selected.toFixed(1)} percent`}${state === null || !stateBenchmark ? "" : `; ${stateBenchmark.name}: ${state.toFixed(1)} percent`}${isNationalOverview ? "." : `; national benchmark: ${national === null ? "not available" : `${national.toFixed(1)} percent`}.`}`}
              >
                {selected !== null && <i className="comparison-fill" style={{ width: `${Math.min(selected, 100)}%` }} />}
                {state !== null && stateBenchmark && <i className="comparison-marker state" style={{ left: `${Math.min(state, 100)}%` }} />}
                {!isNationalOverview && national !== null && <i className="comparison-marker national" style={{ left: `${Math.min(national, 100)}%` }} />}
              </div>
            </div>
          );
        })}
      </div>
      <p className="panel-source"><a href={sourceManifest.indicators.url} target="_blank" rel="noreferrer">{sourceManifest.indicators.source}</a> · released {sourceManifest.indicators.released}. Model-based prevalence and service estimates; percentages may use different eligible populations, so compare each row only with the same measure.</p>
    </section>
  );
}
