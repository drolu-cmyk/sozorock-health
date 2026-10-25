import { HealthEvidenceMethods } from "./HealthEvidenceMethods";

const families = [
  ["Health and access", "Access barriers, chronic conditions and prevention, across 21 health measures."],
  ["Community conditions", "Housing, food, transportation and income, from the American Community Survey and the Community-Level Health Database."],
  ["Workforce and shortages", "Health Professional Shortage Areas, Medically Underserved Areas and the Area Health Resources Files."],
];

const albany = [
  ["5.5%", "of adults aged 18 to 64 have no health insurance", "95% confidence interval: 4.2% to 7.0%"],
  ["7.2%", "of adults lack reliable transportation", "95% confidence interval: 6.1% to 8.5%"],
  ["12.2%", "of adults face food insecurity", "95% confidence interval: 9.9% to 15.0%"],
];

const more = [["Housing insecurity", "10.8%", "9.0% to 12.9%"], ["Utility shutoff threat", "6.6%", "5.5% to 7.9%"], ["Any disability", "25.9%", "22.3% to 29.8%"], ["Loneliness", "36.1%", "31.9% to 40.7%"]];

export function DataPage() {
  return <div className="hx">
    <section className="hx-hero hx-wrap" aria-labelledby="hx-title">
      <p className="hx-label">About the data</p>
      <h1 id="hx-title">Free local data to plan for care.</h1>
      <p className="hx-promise">Health, community and workforce data for counties across the United States, with every source and date.</p>
      <p className="hx-links hx-cta-row"><a className="hx-pill" href="/explore">Find your county</a><a className="hx-text" href="https://cbcap.sozorockfoundation.org/">County planning workspace</a></p>
    </section>

    <section className="hx-families hx-wrap hx-ice" aria-labelledby="hx-families-title">
      <h2 id="hx-families-title" className="hx-label">What the data covers</h2>
      <ul>{families.map(([title, text]) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}</ul>
      <p className="hx-src">Search by county, city or ZIP Code. City and ZIP Code searches resolve to county data; where boundaries overlap, you choose the county.</p>
    </section>

    <section className="hx-example hx-wrap" aria-labelledby="hx-example-title">
      <p className="hx-label">An example</p>
      <h2 id="hx-example-title">Albany County, New York State, at a glance.</h2>
      <ul>{albany.map(([value, text, ci]) => <li key={text}><strong>{value}</strong><p>{text}</p><p className="hx-src">{ci}</p></li>)}</ul>
      <details>
        <summary>More access measures for Albany County</summary>
        <table>
          <thead><tr><th scope="col">Measure</th><th scope="col">Estimate</th><th scope="col">95% confidence interval</th></tr></thead>
          <tbody>{more.map(([m, v, ci]) => <tr key={m}><th scope="row">{m}</th><td>{v}</td><td>{ci}</td></tr>)}</tbody>
        </table>
      </details>
      <p className="hx-src">CDC PLACES, 2025 release: model-based estimates for 2023. Insurance covers adults aged 18 to 64; the other measures cover adults 18 and older. County estimates describe communities, not individual needs or SozoRock results. <a href="https://data.cdc.gov/d/i46a-9kgh">CDC dataset</a> · <a href="/sources/albany-places-2025.json">Albany County source data</a></p>
      <p className="hx-links"><a className="hx-text" href="/explore?kind=county&geoid=36001&view=brief">See the full Albany County brief</a></p>
    </section>

    <section className="hx-tools hx-wrap hx-ice" aria-labelledby="hx-tools-title">
      <h2 id="hx-tools-title" className="hx-label">Two ways to use it</h2>
      <ul>
        <li><h3>Data and maps</h3><p>Look up a county, compare it with others, and download the data with its sources, dates and definitions.</p><a className="hx-text" href="/explore">Find your county</a></li>
        <li><h3>County planning workspace</h3><p>A planning workspace that connects this data to community health assessments and improvement plans. The public preview is open.</p><a className="hx-text" href="https://cbcap.sozorockfoundation.org/">Open the workspace</a></li>
      </ul>
    </section>

    <HealthEvidenceMethods />

    <section className="hx-foundation hx-wrap hx-ice" aria-label="Research">
      <p>What the data means for rural access, county planning and digital health.</p>
      <a className="hx-text" href="/publications">Read the research</a>
    </section>
  </div>;
}
