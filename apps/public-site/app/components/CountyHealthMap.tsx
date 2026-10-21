"use client";

import { useState } from "react";
import data from "../lib/ny-county-map.json";

const ramp = ["#DCEAFF", "#A9C6F0", "#6E9BDF", "#2F66C2", "#0B2F6E"];
const measures = {
  diabetes: { name: "Diabetes", title: "Adults with diagnosed diabetes", bins: [9, 10.5, 12, 13.5], labels: ["<9%", "9–<10.5%", "10.5–<12%", "12–<13.5%", "13.5%+"], state: "11.5%", lead: "An estimated 11.5% of New York adults live with diagnosed diabetes, from 7.6% in Tompkins County to 16.1% in the Bronx." },
  bphigh: { name: "High blood pressure", title: "Adults with high blood pressure", bins: [30, 33, 36, 39], labels: ["<30%", "30–<33%", "33–<36%", "36–<39%", "39%+"], state: "32.6%", lead: "An estimated 32.6% of New York adults have high blood pressure, from 26.1% in Tompkins County to 41.5% in Hamilton County." },
};
type Measure = keyof typeof measures;

export function CountyHealthMap() {
  const [metric, setMetric] = useState<Measure>("diabetes");
  const [selected, setSelected] = useState("");
  const config = measures[metric];
  const county = data.counties.find((c) => c.fips === selected);
  const interval = county?.[metric === "diabetes" ? "diabetesCI" : "bphighCI"];
  const color = (value: number) => ramp[config.bins.filter((cut) => value >= cut).length];
  return <section className="hc-section hc-map-section" aria-labelledby="county-map-title">
    <div className="hc-wrap">
      <div className="hc-map-intro"><h2 id="county-map-title">Chronic conditions reach every corner of the state.</h2><p className="hc-lead">{config.lead}</p></div>
      <div className="hc-toggle" role="group" aria-label="Choose a health measure">{(Object.keys(measures) as Measure[]).map((key) => <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>{measures[key].name}</button>)}</div>
      <div className="hc-map-grid">
        <figure className="hc-county-figure"><svg viewBox={data.viewBox.join(" ")} role="img" aria-labelledby="county-map-svg-title county-map-svg-desc">
          <title id="county-map-svg-title">{`${config.title} across New York’s 62 counties`}</title><desc id="county-map-svg-desc">{config.lead} Select a county below or use the complete table for values and confidence intervals.</desc>
          {data.counties.map((c) => <path key={c.fips} className={selected === c.fips ? "hc-county is-selected" : "hc-county"} d={c.d} fill={color(c[metric])} onMouseEnter={() => setSelected(c.fips)} onClick={() => setSelected(c.fips)}><title>{`${c.name} County: ${c[metric].toFixed(1)}%`}</title></path>)}
        </svg></figure>
        <div className="hc-map-detail">
          <div className="hc-map-reading" aria-live="polite" aria-atomic="true"><p>{county ? config.title : "Statewide estimate"}</p><strong>{county ? county[metric].toFixed(1) + "%" : config.state}</strong><p>{county ? county.name + " County" : "Select a county to compare"}</p>{interval && <p className="hc-note">95% confidence interval: {interval[0].toFixed(1)}–{interval[1].toFixed(1)}%</p>}</div>
          <label className="hc-county-select">Choose a county<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Statewide estimate</option>{data.counties.map((c) => <option key={c.fips} value={c.fips}>{c.name} County</option>)}</select></label>
          <div className="hc-legend"><p>{config.title}</p><div>{ramp.map((fill, i) => <div key={fill}><span style={{ background: fill }} /><small>{config.labels[i]}</small></div>)}</div></div>
          <p className="hc-note">CDC PLACES, 2025 release: model-based estimates for 2023, adults 18+, all 62 counties. Statewide figure is a SozoRock population-weighted calculation from the county estimates. County estimates describe communities, not individuals or program results.</p>
          <a className="hc-methods-link" href="/evidence#methods">Sources and methods</a>
        </div>
      </div>
      <details className="hc-data-table"><summary>View all 62 counties as a table</summary><div className="hc-table-scroll" role="region" aria-label="County estimates" tabIndex={0}><table><caption>{config.title} · 2023 model-based crude prevalence · adults 18+</caption><thead><tr><th scope="col">County</th><th scope="col">Estimate</th><th scope="col">95% confidence interval</th></tr></thead><tbody>{data.counties.map((c) => { const ci = c[metric === "diabetes" ? "diabetesCI" : "bphighCI"]; return <tr key={c.fips}><th scope="row">{c.name}</th><td>{c[metric].toFixed(1)}%</td><td>{ci[0].toFixed(1)}–{ci[1].toFixed(1)}%</td></tr>; })}</tbody></table></div><a href="/sources/ny-county-health-2025.csv" download>Download county estimates and confidence intervals</a></details>
    </div>
  </section>;
}
