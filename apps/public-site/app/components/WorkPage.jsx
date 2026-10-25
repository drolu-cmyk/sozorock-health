const SUPPORT = "https://www.sozorockfoundation.org/support";

const hubs = [
  ["By appointment", "Library Health Equity Hub", "A private room, a device and secure Wi‑Fi in a public library.", "Residents reserve a time when space is available, then join a visit on their own provider’s platform. Libraries make the space available; they do not take part in care."],
  ["At scheduled events", "Community Health Equity Hub", "The same private setup, brought to community spaces.", "Held in community spaces based on availability and reservation, with health education in plain language."],
  ["In development", "Home Health Equity Hub", "Support to use a provider’s platform from home.", "A subscription for people who need help with a device or connection at home. It is not a home-care or clinical service."],
];

const program = [["Up to 25", "people in the first cohort, one per household"], ["12 months", "of sponsored direct primary care"], ["$4,320", "supports one person for a full year"]];

const accessDay = [["Health education", "In plain language, about prevention and chronic illness."], ["Interpretation", "So language is never the reason someone misses care."], ["Screenings", "Delivered by licensed providers."]];

export function WorkPage() {
  return <div className="hx">
    <section className="hx-hero hx-wrap" aria-labelledby="hx-title">
      <p className="hx-label">Our work</p>
      <h1 id="hx-title">Three ways we remove the barriers to care.</h1>
      <p className="hx-promise">Each one answers a gap: too few, too far, too hard.</p>
      <p className="hx-care-note">SozoRock Health does not provide medical care. All care is delivered by licensed providers.</p>
    </section>

    <section className="hx-work hx-wrap hx-ice" id="hubs" aria-labelledby="hx-hubs-title">
      <p className="hx-word" aria-hidden="true">Too far</p>
      <h2 id="hx-hubs-title">Health Equity Hubs</h2>
      <p className="hx-answer">A private place, a device and secure Wi‑Fi close to home, so people can reach the licensed providers who already serve them.</p>
      <ul className="hx-cards">{hubs.map(([status, name, line, detail]) => <li key={name}><span className="hx-status">{status}</span><h3>{name}</h3><p>{line}</p><p className="hx-detail">{detail}</p></li>)}</ul>
      <p className="hx-src">Spaces are used based on availability and reservation. Each visit runs on the provider’s own platform, and the visit and the record stay with the provider.</p>
    </section>

    <section className="hx-work hx-wrap" id="primary-care-access" aria-labelledby="hx-pcap-title">
      <p className="hx-label">When cost stands in the way</p>
      <h2 id="hx-pcap-title">Primary Care Access Program</h2>
      <p className="hx-answer">From January 2027, a sponsored year of direct primary care with Dr. Michael Purcell and Purcell Integrative Osteopathic Care, for New Yorkers aged 64 or younger with financial need and a chronic condition such as diabetes or high blood pressure.</p>
      <ul className="hx-facts">{program.map(([n, t]) => <li key={n}><strong>{n}</strong><p>{t}</p></li>)}</ul>
      <p className="hx-links"><a className="hx-pill" href="/primary-care-access">See the program</a><a className="hx-text" href="/interest">Join the interest list</a><a className="hx-text" href={SUPPORT}>Sponsor a participant</a></p>
      <p className="hx-src">Membership is not health insurance. Clinical care stays with the licensed provider.</p>
    </section>

    <section className="hx-work hx-wrap hx-ice" id="health-access-day" aria-labelledby="hx-had-title">
      <p className="hx-word" aria-hidden="true">Too hard</p>
      <h2 id="hx-had-title">Health Access Day</h2>
      <p className="hx-answer">Held in the ZIP Codes where chronic illness runs highest, and aligned with local health priorities and the priorities of the funders who support it.</p>
      <ul className="hx-cards">{accessDay.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}</ul>
      <p className="hx-src">Results are shared only as non-identifying, aggregate data that counties can use in community health assessments and improvement plans.</p>
    </section>

    <section className="hx-work hx-wrap" aria-labelledby="hx-data-title">
      <p className="hx-word" aria-hidden="true">Too few</p>
      <h2 id="hx-data-title">Local data for local plans</h2>
      <p className="hx-answer">Place Intelligence gives free county data on health, community and workforce conditions. CB-CAP connects that data to planning for the health workforce pipeline, volunteers and an aging population.</p>
      <p className="hx-links"><a className="hx-pill" href="/evidence">Explore data and maps</a><a className="hx-text" href="https://cbcap.sozorockfoundation.org/">CB-CAP county planning</a></p>
    </section>

    <section className="hx-you hx-wrap" aria-labelledby="hx-providers-title">
      <h2 id="hx-providers-title" className="hx-label">For providers</h2>
      <p className="hx-what hx-wide">Residents use your platform, so clinical systems, records, consent and medical decisions stay with you. We help people reach you.</p>
      <p className="hx-links"><a href="/contact">Talk with us</a></p>
    </section>
  </div>;
}
