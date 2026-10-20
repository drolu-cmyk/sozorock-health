"use client";

import { useState } from "react";
import barriers from "../lib/access-barriers.json";

function WorkforceEvidence() {
  return <div className="access-evidence" id="current-evidence">
    <h3>Primary care shortages in New York</h3>
    <p className="fine">HRSA snapshot · September 30, 2026</p>
    <figure className="workforce-chart" aria-labelledby="workforce-chart-title">
      <figcaption id="workforce-chart-title">Primary-care workforce need met</figcaption>
      <p className="chart-subtitle">In designated primary-care shortage areas</p>
      <div role="img" aria-label="Share of primary-care workforce need met in designated shortage areas: New York 35.42 percent; national total 46.75 percent. Scale from 0 to 100 percent.">
        {[{ name: "New York", value: 35.42, className: "" }, { name: "National total", value: 46.75, className: "national" }].map((row) => <div className="chart-row" key={row.name} aria-hidden="true">
          <div className="chart-label"><span>{row.name}</span><strong>{row.value.toFixed(2)}%</strong></div>
          <div className="chart-track"><div className={`chart-bar ${row.className}`} style={{ width: `${row.value}%` }} /></div>
        </div>)}
        <div className="chart-axis" aria-hidden="true">{[0, 25, 50, 75, 100].map((tick) => <span key={tick}>{tick}%</span>)}</div>
      </div>
      <p className="chart-note">New York’s share was 11.33 percentage points below the national total.</p>
    </figure>
    <div className="metric-pair">
      <div><strong>5.29 million</strong><span>Population in designated primary-care shortage areas in New York.</span></div>
      <div><strong>1,130</strong><span>Additional primary-care physicians needed to remove those shortage designations.</span></div>
    </div>
    <p className="access-source">Source: <a href="/sources/hrsa-september-2026.pdf">HRSA, FY 2026 fourth-quarter report, Table 3</a>. Exact reported population: 5,288,766. Retrieved October 20, 2026. <a href="/sources/hrsa-september-2026.csv" download>Download chart data</a>.</p>
    <details><summary>What these figures do and do not show</summary>
      <p>Percent of need met compares available primary-care physicians with the number required to remove a shortage designation. It is not the percentage of people receiving care. The national total includes New York; this is a same-date comparison, not a trend or a causal claim.</p>
      <p>The population figure does not mean that 5.29 million people have no care. Neither measure establishes appointment waiting times or a SozoRock program result. The physician calculation excludes additional services from nurse practitioners and physician assistants. See Table 3, page 5, and the endnotes on pages 14–15.</p>
    </details>
  </div>;
}

export function AccessBarriers() {
  const [selected, setSelected] = useState("capacity");
  const barrier = barriers.find((item) => item.key === selected) ?? barriers[1];
  return <section className="section access-barriers" id="access-barriers" aria-labelledby="soz-barrier-heading">
    <div className="shell">
      <div className="soz-intro"><h2 id="soz-barrier-heading">Where access breaks down.</h2><p>Care must be available, affordable, reachable and usable. Different barriers call for different responses.</p></div>
      <div className="soz-barriers" role="group" aria-label="Explore access barriers">
        {barriers.map((item) => <button type="button" key={item.key} aria-pressed={selected === item.key} aria-controls="soz-access-detail" onClick={() => setSelected(item.key)}>{item.title}</button>)}
      </div>
      <div id="soz-access-detail" className="soz-detail" aria-live="polite" aria-atomic="true">
        {barrier.chart ? <WorkforceEvidence /> : <h3>{barrier.title}</h3>}
        <div className="soz-detail-grid">
          <div><h4>Access in practice</h4><p>{barrier.context}</p><h4>Evidence</h4><p>{barrier.limits}</p></div>
          <div><h4>How the program helps</h4><p>{barrier.role}</p></div>
        </div>
        <p className="soz-source">{barrier.source}</p>
      </div>
      <div className="soz-program"><p><strong>Primary Care Access Program</strong><br />Up to 25 New Yorkers · 12 months of support · Beginning January 2027</p></div>
    </div>
  </section>;
}
