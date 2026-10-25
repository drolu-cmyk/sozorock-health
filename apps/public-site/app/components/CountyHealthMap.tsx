"use client";

import { useState } from "react";
import data from "../lib/ny-county-map.json";

const ramp = ["#DCEAFF", "#A9C6F0", "#6E9BDF", "#2F66C2", "#0B2F6E"];
const measures = {
  diabetes: { name: "Diabetes", title: "Adults with diagnosed diabetes", bins: [9, 10.5, 12, 13.5], labels: ["<9%", "9–<10.5%", "10.5–<12%", "12–<13.5%", "13.5%+"], state: "11.5%", lead: "An estimated 11.5% of New York adults live with diagnosed diabetes, from 7.6% in Tompkins County to 16.1% in the Bronx." },
  bphigh: { name: "High blood pressure", title: "Adults with high blood pressure", bins: [30, 33, 36, 39], labels: ["<30%", "30–<33%", "33–<36%", "36–<39%", "39%+"], state: "32.6%", lead: "An estimated 32.6% of New York adults have high blood pressure, from 26.1% in Tompkins County to 41.5% in Hamilton County." },
};
type Measure = keyof typeof measures;

const spanishMeasures: Record<Measure, { name: string; title: string; lead: string }> = {
  diabetes: { name: "Diabetes", title: "Adultos con diabetes diagnosticada", lead: "Se estima que el 11.5% de los adultos de Nueva York vive con diabetes diagnosticada, desde el 7.6% en el condado de Tompkins hasta el 16.1% en el Bronx." },
  bphigh: { name: "Presión arterial alta", title: "Adultos con presión arterial alta", lead: "Se estima que el 32.6% de los adultos de Nueva York tiene presión arterial alta, desde el 26.1% en el condado de Tompkins hasta el 41.5% en el condado de Hamilton." },
};

const TEXT = {
  en: { heading: "Chronic conditions reach every corner of the state.", choose: "Choose a health measure", across: (t: string) => `${t} across New York’s 62 counties`, desc: "Select a county below or use the complete table for values and confidence intervals.", county: (n: string) => `${n} County`, statewide: "Statewide estimate", select: "Select a county to compare", ci: "95% confidence interval:", chooseCounty: "Choose a county", note: "CDC PLACES, 2025 release: model-based estimates for 2023, adults 18+, all 62 counties. Statewide figure is a SozoRock population-weighted calculation from the county estimates. County estimates describe communities, not individuals or program results.", methods: "Sources and methods", table: "View all 62 counties as a table", region: "County estimates", caption: (t: string) => `${t} · 2023 model-based crude prevalence · adults 18+`, colCounty: "County", colEstimate: "Estimate", colCi: "95% confidence interval", download: "Download county estimates and confidence intervals" },
  es: { heading: "Las enfermedades crónicas llegan a todos los rincones del estado.", choose: "Elija una medida de salud", across: (t: string) => `${t} en los 62 condados de Nueva York`, desc: "Seleccione un condado abajo o use la tabla completa para ver los valores y los intervalos de confianza.", county: (n: string) => `Condado de ${n}`, statewide: "Estimación estatal", select: "Seleccione un condado para comparar", ci: "Intervalo de confianza del 95%:", chooseCounty: "Elija un condado", note: "CDC PLACES, edición de 2025: estimaciones basadas en modelos para 2023, adultos de 18 años o más, los 62 condados. La cifra estatal es un cálculo de SozoRock ponderado por población a partir de las estimaciones de los condados. Las estimaciones por condado describen comunidades, no personas ni resultados del programa.", methods: "Fuentes y métodos (en inglés)", table: "Ver los 62 condados en una tabla", region: "Estimaciones por condado", caption: (t: string) => `${t} · prevalencia bruta basada en modelos, 2023 · adultos de 18 años o más`, colCounty: "Condado", colEstimate: "Estimación", colCi: "Intervalo de confianza del 95%", download: "Descargar las estimaciones por condado y sus intervalos de confianza" },
};

export function CountyHealthMap({ spanish = false }: { spanish?: boolean }) {
  const [metric, setMetric] = useState<Measure>("diabetes");
  const [selected, setSelected] = useState("");
  const t = spanish ? TEXT.es : TEXT.en;
  const config = spanish ? { ...measures[metric], ...spanishMeasures[metric] } : measures[metric];
  const countyName = (name: string) => t.county(name);
  const county = data.counties.find((c) => c.fips === selected);
  const interval = county?.[metric === "diabetes" ? "diabetesCI" : "bphighCI"];
  const color = (value: number) => ramp[config.bins.filter((cut) => value >= cut).length];
  return <section className="hc-section hc-map-section" aria-labelledby="county-map-title">
    <div className="hc-wrap">
      <div className="hc-map-intro"><h2 id="county-map-title">{t.heading}</h2><p className="hc-lead">{config.lead}</p></div>
      <div className="hc-toggle" role="group" aria-label={t.choose}>{(Object.keys(measures) as Measure[]).map((key) => <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>{spanish ? spanishMeasures[key].name : measures[key].name}</button>)}</div>
      <div className="hc-map-grid">
        <figure className="hc-county-figure"><svg viewBox={data.viewBox.join(" ")} role="img" aria-labelledby="county-map-svg-title county-map-svg-desc">
          <title id="county-map-svg-title">{t.across(config.title)}</title><desc id="county-map-svg-desc">{config.lead} {t.desc}</desc>
          {data.counties.map((c) => <path key={c.fips} className={selected === c.fips ? "hc-county is-selected" : "hc-county"} d={c.d} fill={color(c[metric])} onMouseEnter={() => setSelected(c.fips)} onClick={() => setSelected(c.fips)}><title>{`${countyName(c.name)}: ${c[metric].toFixed(1)}%`}</title></path>)}
        </svg></figure>
        <div className="hc-map-detail">
          <div className="hc-map-reading" aria-live="polite" aria-atomic="true"><p>{county ? config.title : t.statewide}</p><strong>{county ? county[metric].toFixed(1) + "%" : config.state}</strong><p>{county ? countyName(county.name) : t.select}</p>{interval && <p className="hc-note">{t.ci} {interval[0].toFixed(1)}–{interval[1].toFixed(1)}%</p>}</div>
          <label className="hc-county-select">{t.chooseCounty}<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">{t.statewide}</option>{data.counties.map((c) => <option key={c.fips} value={c.fips}>{countyName(c.name)}</option>)}</select></label>
          <div className="hc-legend"><p>{config.title}</p><div>{ramp.map((fill, i) => <div key={fill}><span style={{ background: fill }} /><small>{config.labels[i]}</small></div>)}</div></div>
          <p className="hc-note">{t.note}</p>
          <a className="hc-methods-link" href="/evidence#methods">{t.methods}</a>
        </div>
      </div>
      <details className="hc-data-table"><summary>{t.table}</summary><div className="hc-table-scroll" role="region" aria-label={t.region} tabIndex={0}><table><caption>{t.caption(config.title)}</caption><thead><tr><th scope="col">{t.colCounty}</th><th scope="col">{t.colEstimate}</th><th scope="col">{t.colCi}</th></tr></thead><tbody>{data.counties.map((c) => { const ci = c[metric === "diabetes" ? "diabetesCI" : "bphighCI"]; return <tr key={c.fips}><th scope="row">{c.name}</th><td>{c[metric].toFixed(1)}%</td><td>{ci[0].toFixed(1)}–{ci[1].toFixed(1)}%</td></tr>; })}</tbody></table></div><a href="/sources/ny-county-health-2025.csv" download>{t.download}</a></details>
    </div>
  </section>;
}
