"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Info } from "@phosphor-icons/react";
import { conditionMetrics, indicatorValue, metricInterval } from "../lib/metrics";
import type { GeographyProfile, MetricKey } from "../lib/types";
import sourceManifest from "../../data/source-manifest.json";

function compact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Math.round(value));
}

function linePath(values: number[], width: number, height: number, max: number) {
  return values.map((value, index) => {
    const x = 28 + (index / Math.max(values.length - 1, 1)) * (width - 56);
    const y = height - 28 - (value / Math.max(max, 1)) * (height - 56);
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function ScenarioPlanner({ profile }: { profile: GeographyProfile | null }) {
  const [condition, setCondition] = useState<MetricKey>("diabetes");
  const [horizon, setHorizon] = useState(5);
  const [annualPopulationChange, setAnnualPopulationChange] = useState(0);
  const [hubs, setHubs] = useState(3);
  const [weeklyPathways, setWeeklyPathways] = useState(18);
  const [completionRate, setCompletionRate] = useState(70);

  const scenario = useMemo(() => {
    if (!profile) return null;
    const population = profile.adultPopulation ?? profile.population;
    const prevalence = indicatorValue(profile, condition);
    if (population === null || prevalence === null) return null;
    const interval = metricInterval(profile, condition) ?? [Math.max(0, prevalence - 1.5), prevalence + 1.5];
    const years = Array.from({ length: horizon + 1 }, (_, year) => year);
    const project = (rate: number) => years.map((year) =>
      population * ((1 + annualPopulationChange / 100) ** year) * (rate / 100),
    );
    const low = project(interval[0]);
    const base = project(prevalence);
    const high = project(interval[1]);
    const annualPathwayCapacity = hubs * weeklyPathways * 48 * (completionRate / 100);
    return { years, low, base, high, annualPathwayCapacity, prevalence, interval };
  }, [annualPopulationChange, completionRate, condition, horizon, hubs, profile, weeklyPathways]);

  const width = 720;
  const height = 250;
  const maximum = scenario ? Math.max(...scenario.high, 1) : 1;
  const conditionLabel = conditionMetrics.find((metric) => metric.key === condition)?.label ?? "Selected condition";

  return (
    <section className="analysis-panel scenario-panel" id="scenarios" aria-labelledby="scenario-heading">
      <header className="panel-heading">
        <div>
          <span>Planning scenarios</span>
          <h2 id="scenario-heading">Explore a planning range before choosing a response.</h2>
          <p>Adjust transparent assumptions to test a planning horizon and a non-clinical pathway-capacity scenario.</p>
        </div>
        <div className="scenario-boundary"><Info size={17} aria-hidden="true" />Scenario, not observed demand</div>
      </header>
      {!profile ? (
        <div className="scenario-empty">
          <strong>Choose a county, city, or ZIP-linked area to begin.</strong>
          <p>The scenario will use that geography’s population and selected CDC PLACES estimate.</p>
        </div>
      ) : (
        <>
          <div className="scenario-controls">
            <label>
              <span>Health priority</span>
              <select value={condition} onChange={(event) => setCondition(event.target.value as MetricKey)}>
                {conditionMetrics.map((metric) => <option key={metric.key} value={metric.key}>{metric.label}</option>)}
              </select>
            </label>
            <label>
              <span>Planning horizon</span>
              <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
                <option value={1}>1 year</option>
                <option value={3}>3 years</option>
                <option value={5}>5 years</option>
                <option value={10}>10 years</option>
              </select>
            </label>
            <label>
              <span>Annual population change <b>{annualPopulationChange > 0 ? "+" : ""}{annualPopulationChange}%</b></span>
              <input type="range" min="-3" max="5" step="0.5" value={annualPopulationChange} onChange={(event) => setAnnualPopulationChange(Number(event.target.value))} />
            </label>
          </div>
          {scenario ? (
            <div className="scenario-layout">
              <div className="scenario-chart">
                <div className="scenario-chart__summary">
                  <span>{profile.name}</span>
                  <strong>{compact(scenario.base.at(-1) ?? 0)}</strong>
                  <small>population-equivalent scenario in year {horizon}</small>
                </div>
                <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${conditionLabel} population-equivalent planning scenario for ${profile.name}. The base arithmetic scenario moves from ${compact(scenario.base[0])} to ${compact(scenario.base.at(-1) ?? 0)} over ${horizon} years. Low and high lines use the source confidence interval. This is not a count of diagnosed people, future cases, or forecast demand.`}>
                  <title>{conditionLabel} planning scenario for {profile.name}</title>
                  {[0, 1, 2, 3].map((index) => <line key={index} x1="28" x2={width - 28} y1={28 + index * 55} y2={28 + index * 55} className="scenario-gridline" />)}
                  <path d={linePath(scenario.low, width, height, maximum)} className="scenario-line low" />
                  <path d={linePath(scenario.high, width, height, maximum)} className="scenario-line high" />
                  <path d={linePath(scenario.base, width, height, maximum)} className="scenario-line base" />
                  {scenario.base.map((value, index) => {
                    const x = 28 + (index / Math.max(scenario.base.length - 1, 1)) * (width - 56);
                    const y = height - 28 - (value / maximum) * (height - 56);
                    return <circle key={scenario.years[index]} cx={x} cy={y} r="4" className="scenario-point"><title>Year {scenario.years[index]}: {Math.round(value).toLocaleString("en-US")}</title></circle>;
                  })}
                </svg>
                <div className="scenario-axis"><span>Now</span><span>Year {horizon}</span></div>
                <div className="scenario-key"><span><i className="low" />Low</span><span><i className="base" />Base</span><span><i className="high" />High</span></div>
              </div>
              <aside className="capacity-model">
                <span>Health Equity Hub capacity model</span>
                <h3>Test a non-clinical pathway.</h3>
                <label><span>Hub locations <b>{hubs}</b></span><input type="range" min="1" max="25" value={hubs} onChange={(event) => setHubs(Number(event.target.value))} /></label>
                <label><span>Pathways prepared per hub/week <b>{weeklyPathways}</b></span><input type="range" min="4" max="60" step="2" value={weeklyPathways} onChange={(event) => setWeeklyPathways(Number(event.target.value))} /></label>
                <label><span>Scenario completion <b>{completionRate}%</b></span><input type="range" min="25" max="95" step="5" value={completionRate} onChange={(event) => setCompletionRate(Number(event.target.value))} /></label>
                <div className="capacity-result">
                  <strong>{compact(scenario.annualPathwayCapacity)}</strong>
                  <span>illustrative pathway-capacity scenario/year</span>
                </div>
                <p><ArrowRight size={15} aria-hidden="true" />Use this to discuss staffing, hub locations, language support, and provider-led capacity—not to predict clinical demand.</p>
              </aside>
            </div>
          ) : (
            <div className="scenario-empty">
              <strong>This measure is not available for {profile.name}.</strong>
              <p>Choose another health priority or geography. Missing data is never treated as zero.</p>
            </div>
          )}
        </>
      )}
      <p className="panel-source"><a href={sourceManifest.indicators.url} target="_blank" rel="noreferrer">{sourceManifest.indicators.source}</a> · released {sourceManifest.indicators.released}. Scenario totals are population-equivalent arithmetic based on a published model estimate and user-selected assumptions. They are not diagnosed people, future cases, observed service demand, or a forecast.</p>
    </section>
  );
}
