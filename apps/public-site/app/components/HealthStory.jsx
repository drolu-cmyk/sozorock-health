import { StateGapMap } from "./StateGapMap";

const R = <sup className="hx-reg">®</sup>;

const gaps = [
  { word: "Too few", pct: 53, line: "of primary care need goes unmet where providers are short", source: "HRSA, September 30, 2026" },
  { word: "Too far", pct: 28, line: "of rural adults have no broadband at home", source: "Pew Research Center, 2026" },
  { word: "Too hard", pct: 88, line: "of adults lack proficient health literacy", source: "U.S. Department of Health and Human Services" },
];

const audiences = [
  { who: "Residents", what: "A way in to care near you, in your language.", cta: "Join the interest list", href: "/interest" },
  { who: "Providers", what: "Reach the people you are missing.", cta: "Talk with us", href: "/contact" },
  { who: "Counties", what: "Local data for your community health plan.", cta: "Explore county data", href: "/explore" },
  { who: "Funders", what: "Measurable access where need is highest.", cta: "Support the work", href: "https://www.sozorockfoundation.org/support" },
];

const research = [
  { title: "Rural Equity Blueprint", idea: "Put care where people already go: the library, the community center and the home.", href: "/publications/rural-equity-blueprint-volume-1", src: "/media/health-home/rebs-cover.webp", w: 640, h: 905 },
  { title: "Rethinking Rural Governance", idea: "Counties already hold the data they need to plan health. Connect it.", href: "/publications/rethinking-rural-governance-volume-1", src: "/media/health-home/rrg-cover.webp", w: 640, h: 828 },
  { title: "Health Systems Assurance", idea: "Digital health earns trust when it is tested, not assumed.", href: "/publications/health-systems-assurance-volume-1", src: "/media/health-home/hsa-cover.webp", w: 640, h: 828 },
];

function Donut({ pct }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return <svg className="hx-donut" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
    <circle cx="64" cy="64" r={r} className="hx-donut-track" />
    <circle cx="64" cy="64" r={r} className="hx-donut-fill" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 64 64)" />
  </svg>;
}

function Gap({ id, word, title, covers, answer, links, children, ice }) {
  return <section className={`hx-gap-row hx-wrap${ice ? " hx-ice" : ""}`} aria-labelledby={id}>
    <div className="hx-gap-copy">
      <p className="hx-word" aria-hidden="true">{word}</p>
      <h2 id={id}>{title}</h2>
      <p className="hx-covers">{covers}</p>
      <p className="hx-answer">{answer}</p>
      <p className="hx-links">{links.map(([text, href]) => <a key={href} className="hx-text" href={href}>{text}</a>)}</p>
    </div>
    {children}
  </section>;
}

export function HealthStory() {
  return <div className="hx">
    <section className="hx-hero hx-wrap" aria-labelledby="hx-title">
      <p className="hx-label">Care. For every ZIP Code.</p>
      <h1 id="hx-title">Care is too few, too far and too hard to reach.</h1>
      <p className="hx-promise">We help change all three.</p>
      <ul className="hx-gaps" aria-label="Three gaps between people and care">
        {gaps.map((g) => <li key={g.word}>
          <div className="hx-donut-wrap"><Donut pct={g.pct} /><span className="hx-donut-num" aria-hidden="true">{g.pct}%</span></div>
          <div><p className="hx-gap-word">{g.word}</p><p className="hx-gap-line"><span className="hx-sr">{g.pct}% </span>{g.line}</p><p className="hx-src">{g.source}</p></div>
        </li>)}
      </ul>
    </section>

    <Gap ice id="hx-few" word="Too few" title="Too few providers. Too long to wait." covers="Provider shortages, wait times, a shrinking health workforce and an aging population." answer="We give counties clear local data to plan for the care their residents need." links={[["Place Intelligence", "/explore"], ["CB-CAP county planning", "https://cbcap.sozorockfoundation.org/"]]}>
      <StateGapMap />
    </Gap>

    <Gap id="hx-far" word="Too far" title="Too far, too costly, too disconnected." covers="Distance, transportation, no device or internet, no private place and cost." answer="Health Equity Hubs bring a private place, a device and secure Wi‑Fi close to home. When cost stands in the way, we sponsor a year of primary care." links={[["Health Equity Hubs", "/work#hubs"], ["Primary Care Access Program", "/primary-care-access"]]}>
      <figure className="hx-hubs">
        <div className="hx-hubs-ends" aria-hidden="true"><span>In a public space</span><span>At home</span></div>
        <ol>
          <li><span className="hx-node" aria-hidden="true" /><strong>Library</strong><span>By appointment</span></li>
          <li><span className="hx-node" aria-hidden="true" /><strong>Community</strong><span>At scheduled events</span></li>
          <li><span className="hx-node open" aria-hidden="true" /><strong>Home</strong><span>In development</span></li>
        </ol>
        <figcaption>Each visit runs on the provider’s own platform. The visit and the record stay with the provider.</figcaption>
      </figure>
    </Gap>

    <Gap ice id="hx-hard" word="Too hard" title="Too hard to understand. Too late to prevent." covers="Language, translation, health literacy, prevention not reached and chronic illness found late." answer="Health Access Day brings health education, interpretation and screenings by licensed providers to the ZIP Codes where chronic illness runs highest." links={[["Health Access Day", "/work#health-access-day"]]}>
      <figure className="hx-venn" aria-label="Health Access Day sits where high chronic illness, low access and local health priorities overlap">
        <span className="c1" /><span className="c2" /><span className="c3" />
        <em className="l1">High chronic illness</em><em className="l2">Low access</em><em className="l3">Local health priorities</em>
        <strong>Health Access Day</strong>
      </figure>
    </Gap>

    <section className="hx-you hx-wrap" aria-labelledby="hx-you-title">
      <h2 id="hx-you-title" className="hx-label">What it means for you</h2>
      <ul>
        {audiences.map((a) => <li key={a.who}><p className="hx-who">{a.who}</p><p className="hx-what">{a.what}</p><a href={a.href}>{a.cta}</a></li>)}
      </ul>
      <p className="hx-care">SozoRock{R} Health does not provide medical care. All care is delivered by licensed providers.</p>
    </section>

    <section className="hx-research hx-wrap" aria-labelledby="hx-research-title">
      <div className="hx-research-head">
        <p className="hx-label">Research</p>
        <h2 id="hx-research-title">Three ideas for reaching every ZIP Code.</h2>
        <a className="hx-text" href="/publications">Explore all research</a>
      </div>
      <ul>
        {research.map((p) => <li key={p.title}><a href={p.href}><img src={p.src} width={p.w} height={p.h} alt={`${p.title}, Volume 1 cover`} loading="lazy" decoding="async" /><strong>{p.title}</strong><span>{p.idea}</span></a></li>)}
      </ul>
    </section>

    <section className="hx-foundation hx-wrap hx-ice" aria-label="The SozoRock Foundation">
      <p>Part of The SozoRock Foundation: access, capacity and trust.</p>
      <a className="hx-text" href="https://www.sozorockfoundation.org/">Visit the Foundation</a>
    </section>
  </div>;
}
