const SUPPORT = "https://www.sozorockfoundation.org/support";

const hubs = [
  ["By appointment", "Library Health Equity Hub", "A private room, a device and secure Wi‑Fi in a public library.", "Residents reserve a time when space is available, then join a visit on their own provider’s platform. Libraries make the space available; they do not take part in care."],
  ["At scheduled events", "Community Health Equity Hub", "The same private setup, brought to community spaces.", "Held in community spaces based on availability and reservation, with health education in plain language."],
  ["In development", "Home Health Equity Hub", "Support to use a provider’s platform from home.", "A subscription for people who need help with a device or connection at home. It is not a home-care or clinical service."],
];

const accessDay = [["Health education", "In plain language, about prevention and chronic illness."], ["Interpretation", "So language is never the reason someone misses care."], ["Screenings", "Delivered by licensed providers."]];

export function WorkPage() {
  return <div className="hx">
    <section className="hx-hero hx-wrap" aria-labelledby="hx-title">
      <p className="hx-label">Our work</p>
      <h1 id="hx-title">Three ways we remove the barriers to care.</h1>
      <p className="hx-promise">Each one answers a gap between people and care.</p>
    </section>

    <section className="hx-work hx-wrap" id="data" aria-labelledby="hx-data-title">
      <p className="hx-word" aria-hidden="true">Too few</p>
      <h2 id="hx-data-title">Local data for local plans</h2>
      <p className="hx-answer">Free health, community and workforce data for every county, and a planning workspace that connects it to the health workforce pipeline, volunteers and an aging population.</p>
      <p className="hx-links"><a className="hx-pill" href="/explore">Find your county</a><a className="hx-text" href="https://cbcap.sozorockfoundation.org/">County planning workspace</a></p>
    </section>

    <section className="hx-work hx-wrap hx-ice" id="hubs" aria-labelledby="hx-hubs-title">
      <p className="hx-word" aria-hidden="true">Too far</p>
      <h2 id="hx-hubs-title">Health Equity Hubs</h2>
      <p className="hx-answer">A private place, a device and secure Wi‑Fi close to home, so people can reach the licensed providers who already serve them.</p>
      <ul className="hx-cards">{hubs.map(([status, name, line, detail]) => <li key={name}><span className="hx-status">{status}</span><h3>{name}</h3><p>{line}</p><p className="hx-detail">{detail}</p></li>)}</ul>
      <p className="hx-src">Spaces are used when available and reserved. Each visit runs on the provider’s own platform, and the record stays with the provider.</p>
    </section>

    <section className="hx-work hx-wrap" id="primary-care-access" aria-labelledby="hx-pcap-title">
      <p className="hx-label">When cost stands in the way</p>
      <h2 id="hx-pcap-title">Primary Care Access Program</h2>
      <p className="hx-answer">From January 2027, a sponsored year of direct primary care for up to 25 New Yorkers with financial need and a chronic condition.</p>
      <p className="hx-links"><a className="hx-pill" href="/primary-care-access">See the program</a><a className="hx-text" href="/interest">Join the interest list</a><a className="hx-text" href={SUPPORT}>Sponsor a participant</a></p>
    </section>

    <section className="hx-work hx-wrap hx-ice" id="health-access-day" aria-labelledby="hx-had-title">
      <p className="hx-word" aria-hidden="true">Too hard</p>
      <h2 id="hx-had-title">Health Access Day</h2>
      <p className="hx-answer">A day of health education, interpretation and screenings by licensed providers, held in the ZIP Codes where chronic illness runs highest and matched to the county’s own health priorities.</p>
      <ul className="hx-cards">{accessDay.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}</ul>
      <p className="hx-src">Results are shared only as non-identifying, aggregate data that counties can use in community health assessments and improvement plans.</p>
      <p className="hx-links"><a className="hx-pill" href="/contact?audience=counties">Request a Health Access Day</a></p>
    </section>

    <section className="hx-you hx-wrap" aria-labelledby="hx-providers-title">
      <h2 id="hx-providers-title" className="hx-label">For providers</h2>
      <p className="hx-what hx-wide">Residents use your platform, so clinical systems, records, consent and medical decisions stay with you. We help people reach you.</p>
      <p className="hx-links"><a href="/contact?audience=providers">Tell us about your practice</a></p>
    </section>
  </div>;
}
