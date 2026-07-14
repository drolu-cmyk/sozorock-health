"use client";

import type { StateSummary } from "../lib/types";
import { formatOrdinal } from "../lib/metrics";
import sourceManifest from "../../data/source-manifest.json";

export function StateRanking({
  states,
  selectedState,
  onSelect,
}: {
  states: StateSummary[];
  selectedState: string;
  onSelect: (stateFips: string) => void;
}) {
  const ranked = [...states]
    .filter((state) => state.medianPlanningPressure !== null)
    .sort((a, b) => (b.medianPlanningPressure ?? 0) - (a.medianPlanningPressure ?? 0))
    .slice(0, 12);
  return (
    <section className="analysis-panel state-ranking" aria-labelledby="state-ranking-heading">
      <header className="panel-heading">
        <div>
          <span>National comparison</span>
          <h2 id="state-ranking-heading">Where planning pressure clusters.</h2>
          <p>State medians summarize county demonstration-index percentiles. They are not state performance grades.</p>
        </div>
      </header>
      <div className="ranking-bars">
        {ranked.map((state) => (
          <button
            type="button"
            key={state.fips}
            className={selectedState === state.fips ? "is-selected" : ""}
            onClick={() => onSelect(state.fips)}
          >
            <span>{state.name}</span>
            <div aria-hidden="true"><i style={{ width: `${state.medianPlanningPressure ?? 0}%` }} /></div>
            <strong>{state.medianPlanningPressure}</strong>
            <span className="sr-only">— median planning pressure {formatOrdinal(state.medianPlanningPressure)} percentile; show state</span>
          </button>
        ))}
      </div>
      <p className="panel-source"><a href={sourceManifest.indicators.url} target="_blank" rel="noreferrer">{sourceManifest.indicators.source}</a> · released {sourceManifest.indicators.released}. State medians use the CB-CAP demonstration calculation disclosed in Methods and data; status: {sourceManifest.demonstrationIndex.status}.</p>
    </section>
  );
}
