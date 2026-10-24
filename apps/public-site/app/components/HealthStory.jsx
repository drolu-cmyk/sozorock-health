import Image from "next/image";

const R = <sup className="hx-reg">®</sup>;

const milestones = [
  ["September 2025", "Western New York roundtable put rural access gaps on the record."],
  ["2025", "Rural Equity Blueprint, Volume 1, sets out the hub models."],
  ["2026", "Place Intelligence opens county evidence to the public."],
  ["January 2027", "The first Primary Care Access Program cohort begins."],
];

function Bar({ name, pct, tone }) {
  return <div className="hx-bar">
    <div className="hx-bar-head"><span>{name}</span><span className={`hx-bar-num ${tone}`}>{pct}%</span></div>
    <div className="hx-track" aria-hidden="true"><div className={`hx-fill ${tone}`} style={{ width: `${pct}%` }} /></div>
  </div>;
}

export function HealthStory() {
  return <div className="hx">
    <section className="hx-hero hx-wrap" aria-labelledby="hx-title">
      <div className="hx-hero-copy">
        <p className="hx-label">Care. For every ZIP Code.</p>
        <h1 id="hx-title">Close the distance between people and care.</h1>
        <p className="hx-lede">We turn trusted local places into doors to care, backed by local evidence and secure digital health.</p>
        <div className="hx-actions"><a className="hx-pill" href="#hx-approach">See how it works</a><a className="hx-text" href="/contact">Partner with us →</a></div>
      </div>
      <Image className="hx-hero-img" src="/media/approved-home/hero-community-desktop-v2.webp" width={1672} height={941} alt="A health access guide and a resident review care options on a tablet in a library" priority />
    </section>

    <section className="hx-problem hx-ice hx-wrap" aria-labelledby="hx-problem-title">
      <div>
        <p className="hx-label">The problem</p>
        <h2 id="hx-problem-title">New York State’s shortage areas meet only about a third of their primary care need.</h2>
        <p className="hx-lede">Care can be nearby and still out of reach because of cost, distance, technology or trust.</p>
      </div>
      <figure className="hx-chart" aria-label="Share of primary care need met in designated shortage areas: United States 46.75 percent, New York State 35.42 percent">
        <Bar name="United States" pct={46.75} tone="navy" />
        <Bar name="New York State" pct={35.42} tone="cobalt" />
        <figcaption>Share of primary care need met in designated shortage areas. HRSA, September 30, 2026.</figcaption>
      </figure>
    </section>

    <section className="hx-insight hx-wrap" aria-labelledby="hx-insight-title">
      <p className="hx-label">Our insight</p>
      <h2 id="hx-insight-title">Libraries, community centers and homes reach the people clinics often miss.</h2>
      <p className="hx-lede">We equip those places to remove the barriers, and we measure what changes.</p>
    </section>

    <div id="hx-approach">
      <section className="hx-row hx-ice hx-wrap" aria-labelledby="hx-understand">
        <div className="hx-map"><Image src="/media/county-map-brand.webp" width={1470} height={844} alt="Map of United States counties with New York State highlighted" /></div>
        <div>
          <p className="hx-label">Understand · Place Intelligence</p>
          <h2 id="hx-understand">See every barrier in a county before you act.</h2>
          <p className="hx-lede">Free public data on health, community and workforce conditions, with every source and date.</p>
          <div className="hx-actions"><a className="hx-pill" href="/explore">Explore your county</a><a className="hx-text" href="https://cbcap.sozorockfoundation.org/" rel="noopener">CB‑CAP county planning →</a></div>
        </div>
      </section>

      <section className="hx-row hx-flip hx-wrap" aria-labelledby="hx-connect">
        <div>
          <p className="hx-label">Connect · Health Equity Initiative</p>
          <h2 id="hx-connect">Open a door to care where people already go.</h2>
          <p className="hx-lede">Health Equity Hubs in libraries, community centers and homes, Health Access Day, and the <a href="/primary-care-access">Primary Care Access Program</a>: a sponsored year of care for up to 25 New Yorkers from January 2027.</p>
          <div className="hx-actions"><a className="hx-pill" href="/contact">Host a hub</a><a className="hx-text" href="/interest">Join the care interest list →</a></div>
        </div>
        <Image className="hx-photo" src="/media/approved-home/hero-tablet.webp" width={1800} height={1350} alt="A community helper shows an older resident how to use a health app" />
      </section>

      <section className="hx-row hx-ice hx-wrap" aria-labelledby="hx-protect">
        <div className="hx-cover"><Image src="/publications/covers/health-systems-assurance-volume-1.jpg" width={2550} height={3300} alt="Health Systems Assurance Series, Volume 1 cover" /></div>
        <div>
          <p className="hx-label">Protect · Digital readiness and assurance</p>
          <h2 id="hx-protect">Make digital health safe enough to trust.</h2>
          <p className="hx-lede">Practical readiness, cybersecurity and evidence for the platforms patients and providers rely on.</p>
          <div className="hx-actions"><a className="hx-pill" href="https://www.sozorockfoundation.org/publication/hsa-v1-2026">Read the research</a></div>
        </div>
      </section>
    </div>

    <section className="hx-progress hx-wrap" aria-labelledby="hx-progress-title">
      <p className="hx-label">Progress</p>
      <h2 id="hx-progress-title">From listening to care.</h2>
      <ol className="hx-steps">
        {milestones.map(([when, what], index) => <li key={when}><span className={`hx-dot${index === milestones.length - 1 ? " next" : ""}`} aria-hidden="true" /><strong>{when}</strong><p>{what}</p></li>)}
      </ol>
    </section>

    <section className="hx-fund hx-wrap" aria-labelledby="hx-fund-title">
      <div>
        <p className="hx-label">For funders and partners</p>
        <h2 id="hx-fund-title">$108,000 gives up to 25 people a year of care.</h2>
        <p className="hx-lede">Built for where health funding is going: rural care coordination, the health workforce and digital access. Sponsors receive reports at months 3, 6, 9 and 12.</p>
      </div>
      <div className="hx-fund-go"><a className="hx-pill hx-white" href="https://www.sozorockfoundation.org/support">Sponsor a participant</a><a className="hx-text" href="/contact">Discuss a partnership →</a></div>
    </section>

    <section className="hx-close hx-wrap" aria-labelledby="hx-close-title">
      <div><p className="hx-label">Need care?</p><h2 id="hx-close-title">Be first to know when enrollment opens.</h2></div>
      <div className="hx-actions"><a className="hx-pill" href="/interest">Join the interest list</a><a className="hx-text" href="/primary-care-access">Who qualifies →</a></div>
    </section>
    <p className="hx-wrap hx-fine">SozoRock{R} Health is an initiative of The SozoRock Foundation, Inc. Clinical care remains with licensed providers.</p>
  </div>;
}
