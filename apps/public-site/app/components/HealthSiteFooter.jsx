const F = "https://www.sozorockfoundation.org";

const columns = [
  ["Our work", [["Health Equity Hubs", "/work#hubs"], ["Health Access Day", "/work#health-access-day"], ["Primary Care Access Program", "/primary-care-access"], ["Place Intelligence", "/explore"], ["CB-CAP County Planning", "https://cbcap.sozorockfoundation.org/"]]],
  ["Research", [["All Research", "/publications"], ["Rural Equity Blueprint", "/publications/rural-equity-blueprint-volume-1"], ["Rethinking Rural Governance", "/publications/rethinking-rural-governance-volume-1"], ["Health Systems Assurance", "/publications/health-systems-assurance-volume-1"], ["Data and Methods", "/evidence"]]],
  ["Work with us", [["For Residents", "/interest"], ["For Providers", "/contact"], ["For Counties", "/explore"], ["For Funders", `${F}/support`], ["Contact Us", "/contact"]]],
  ["The Foundation", [["About the Foundation", `${F}/about`], ["Leadership", `${F}/leadership`], ["Support Our Work", `${F}/support`], ["Our Standards", `${F}/standards`]]],
];

const legal = [["Privacy Notice", "/privacy"], ["Terms of Use", "/terms"], ["Accessibility Statement", "/accessibility"], ["Nondiscrimination Notice", "/nondiscrimination"], ["Contact Us", "/contact"]];

export function HealthSiteFooter() {
  return <footer className="hf">
    <div className="hf-top">
      <div className="hf-brand">
        <a href="/" aria-label="SozoRock Health home">SozoRock<sup className="hx-reg">®</sup> Health</a>
        <p>Care. For every ZIP Code.<br />An initiative of The SozoRock Foundation, Inc.</p>
      </div>
      {columns.map(([title, links]) => <nav key={title} aria-label={title}>
        <h2>{title}</h2>
        <ul>{links.map(([text, href]) => <li key={text}><a href={href}>{text}</a></li>)}</ul>
      </nav>)}
    </div>
    <div className="hf-bottom">
      <nav aria-label="Legal">
        <ul>{legal.map(([text, href]) => <li key={href + text}><a href={href}>{text}</a></li>)}<li><a href="/es" lang="es" hrefLang="es">Español</a></li></ul>
      </nav>
      <p>SozoRock Health does not provide medical care. All care is delivered by licensed providers. Direct primary care membership is not health insurance.</p>
      <p>© 2026 The SozoRock Foundation, Inc. A 501(c)(3) public charity. EIN 39-4736725.</p>
    </div>
  </footer>;
}
