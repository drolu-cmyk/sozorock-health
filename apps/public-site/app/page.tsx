import { Books, Buildings, ChartLineUp, HouseLine, LockKey, MicrophoneStage, Translate, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { ContactForm } from "./components/ContactForm";
import { NationalAccessMap } from "./components/NationalAccessMap";
import { ResidentDemo } from "./components/ResidentDemo";
import { SiteHeader } from "./components/SiteHeader";

const hubs = [
  { icon: Books, title: "Library Hubs", copy: "Trusted, private access in a familiar public place." },
  { icon: Buildings, title: "Community Hubs", copy: "Local partners supporting connection and follow-through." },
  { icon: HouseLine, title: "Home-Based Hubs", copy: "Guided access when leaving home is the barrier." },
];

export default function Home() {
  const cbcapUrl = process.env.NEXT_PUBLIC_CBCAP_URL ?? "#counties";
  return <main id="top">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <SiteHeader />
    <div id="main-content"><NationalAccessMap /></div>

    <section className="hub-model" id="how-it-works">
      <div className="hub-intro"><p className="section-number">02 / The hub model</p><h2>Care is closer than it looks.</h2><p>One access model, designed for the places people already know and trust.</p></div>
      <div className="hub-list">{hubs.map(({icon:Icon,title,copy})=><article key={title}><Icon size={38} weight="light" aria-hidden="true"/><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div>
    </section>

    <section className="resident-section" id="resident">
      <div className="resident-story"><p className="section-number light">03 / Resident access</p><h2>One clear next step.<br/>In your language.</h2><p>Residents can speak, tap, or type to find a pathway, check in at a hub, and connect through a provider&rsquo;s existing platform. The experience collects only what is needed and never gives clinical advice.</p><div className="trust-list"><span><MicrophoneStage size={20}/>Human voice</span><span><Translate size={20}/>Language access</span><span><LockKey size={20}/>Privacy reset</span></div><a href="#find-access">Explore your county</a></div>
      <ResidentDemo />
    </section>

    <section className="partner-model" id="providers">
      <div className="partner-photo" role="img" aria-label="Rural road connecting communities"><div><span>BYOP</span><strong>Providers keep their platform.</strong></div></div>
      <div className="partner-copy"><p className="section-number">04 / For licensed providers</p><h2>Expand access.<br/>Keep what works.</h2><p>Bring Your Own Platform connects residents to a provider&rsquo;s established clinical system. SozoRock handles the access pathway; the provider remains responsible for care.</p><dl><div><dt>01</dt><dd><strong>State verification</strong><span>Providers must be licensed for every state they serve.</span></dd></div><div><dt>02</dt><dd><strong>Qualified connections</strong><span>Receive resident requests without rebuilding clinical workflows.</span></dd></div><div><dt>03</dt><dd><strong>Clear boundaries</strong><span>SozoRock is non-clinical and does not replace professional judgment.</span></dd></div></dl><a className="primary-action dark" href="#partner">Begin provider readiness</a></div>
    </section>

    <section className="county-story" id="counties">
      <div className="county-heading"><p className="section-number light">05 / CB-CAP</p><h2>From fragmented reports to systems intelligence.</h2><p>CB-CAP turns protected, aggregated access activity into a clearer picture of where communities need hubs, language support, providers, and follow-through.</p></div>
      <div className="county-preview"><div className="county-preview-top"><strong>CB-CAP</strong><span>Public demonstration · Illustrative data</span><a href={cbcapUrl} aria-label="Open CB-CAP demonstration">Open dashboard ↗</a></div><div className="metric-row"><div><span>Access pathways</span><strong>42.8k</strong><small>illustrative national activity</small></div><div><span>Hub reach</span><strong>68%</strong><small>of selected communities</small></div><div><span>Language support</span><strong>14</strong><small>languages requested</small></div><div><span>Protected cells</span><strong>&lt;11</strong><small>always suppressed</small></div></div><div className="chart-row"><div className="chart-copy"><ChartLineUp size={38}/><h3>Filter, compare, and download</h3><p>State, county, ZIP, period, hub type, and language views with privacy-aware exports.</p></div><div className="mini-chart" aria-label="Illustrative access trend"><i style={{height:"32%"}}/><i style={{height:"47%"}}/><i style={{height:"44%"}}/><i style={{height:"65%"}}/><i style={{height:"58%"}}/><i style={{height:"79%"}}/><i style={{height:"73%"}}/><i style={{height:"92%"}}/></div></div></div>
    </section>

    <section className="ai-layer" id="technology">
      <div><p className="section-number">06 / AI-native access</p><h2>AI where it removes a barrier. Human judgment where it matters.</h2></div>
      <div className="ai-principles"><article><MicrophoneStage size={32}/><h3>Live voice</h3><p>A natural voice interface with interruption handling and text fallback.</p></article><article><Translate size={32}/><h3>Translation</h3><p>English and Spanish from day one, with a modular path to more languages.</p></article><article><UsersThree size={32}/><h3>Agentic support</h3><p>Purpose-built agents coordinate navigation, readiness, and operations within strict permissions.</p></article><article><LockKey size={32}/><h3>Feature control</h3><p>Every advanced capability can be enabled by state, partner, role, or risk threshold.</p></article></div>
    </section>

    <section className="publications" id="publications">
      <div className="publication-heading"><p className="section-number">07 / The ideas beneath the infrastructure</p><h2>Built from a body of work.</h2><p>Oluwabiyi Adeyemo&rsquo;s publications move rural equity from isolated programs toward durable access and accountable systems intelligence.</p></div>
      <div className="publication-grid"><article><a className="cover" href="/publications/rural-equity-blueprint-volume-1.pdf"><img src="/publications/covers/rural-equity-blueprint-volume-1.png" alt="Cover of Rural Equity Blueprint Series, Volume 1: Access Day"/></a><div><span>Rural Equity Blueprint Series</span><h3>Volume 1: Access Day</h3><p>The hub model, readiness, workforce renewal, literacy, and practical activation.</p><a href="/publications/rural-equity-blueprint-volume-1.pdf" download>Read the publication ↘</a></div></article><article><a className="cover" href="/publications/rethinking-rural-governance-volume-1.pdf"><img src="/publications/covers/rethinking-rural-governance-volume-1.png" alt="Cover of Rethinking Rural Governance, Volume 1"/></a><div><span>Rethinking Rural Governance</span><h3>From Compliance to Systems Intelligence</h3><p>The governance foundation for CB-CAP: proactive, transparent, and designed to help communities act.</p><a href="/publications/rethinking-rural-governance-volume-1.pdf" download>Read the publication ↘</a></div></article></div>
    </section>

    <section className="about" id="about"><p className="section-number light">08 / About SozoRock Health</p><div><h2>National in scope.<br/>Local in activation.</h2><p>SozoRock Health is an initiative of The SozoRock Foundation, Inc., based in New York and designed for every U.S. state and county. Availability follows local interest, verified provider licensure, hub readiness, and responsible launch safeguards.</p></div></section>

    <section className="partner-section" id="partner"><div><p className="section-number">09 / Get involved</p><h2>Where should access begin?</h2><p>Tell us about your community, provider network, library, institution, or county. We will respond with the right readiness path.</p><a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a></div><ContactForm /></section>

    <footer className="site-footer"><div className="brand-lockup footer-brand"><span className="wordmark-image"><img src="/brand/sozorock-wordmark-source.png" alt="SozoRock"/><sup>®</sup></span><span>HEALTH</span></div><p>A national, non-clinical access infrastructure.</p><nav aria-label="Legal and support"><a href="#about">About</a><a href="#publications">Publications</a><a href="#partner">Contact</a><a href="mailto:contact@sozorockfoundation.org">Accessibility</a><a href="mailto:contact@sozorockfoundation.org">Privacy</a></nav><small>© {new Date().getFullYear()} The SozoRock Foundation, Inc. All rights reserved.</small></footer>
  </main>;
}
