import { ArrowRight, ArrowSquareOut, Books, Buildings, ChartLineUp, DownloadSimple, EnvelopeSimple, GlobeHemisphereWest, HouseLine, InstagramLogo, LinkedinLogo, LockKey, MicrophoneStage, Path, Scales, ShieldCheck, Translate, UsersThree, XLogo, YoutubeLogo } from "@phosphor-icons/react/dist/ssr";
import { ContactForm } from "./components/ContactForm";
import { NationalAccessMap } from "./components/NationalAccessMap";
import { ResidentDemo } from "./components/ResidentDemo";
import { SiteHeader } from "./components/SiteHeader";

const hubs = [
  { icon: Books, title: "Library Hubs", copy: "Private technology and trusted navigation in a familiar public place." },
  { icon: Buildings, title: "Community Hubs", copy: "Local organizations helping residents connect and follow through." },
  { icon: HouseLine, title: "Home-Based Hubs", copy: "Guided access when travel, mobility, or distance is the barrier." },
];

const providerSteps = [
  { icon: ShieldCheck, title: "State verification", copy: "Providers must be licensed for every state they serve." },
  { icon: Path, title: "Qualified connections", copy: "Receive resident requests without rebuilding clinical workflows." },
  { icon: Scales, title: "Clear boundaries", copy: "SozoRock is non-clinical and does not replace professional judgment." },
];

export default function Home() {
  const cbcapUrl = process.env.NEXT_PUBLIC_CBCAP_URL ?? "#counties";
  return <main id="top">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <SiteHeader/>
    <div id="main-content"><NationalAccessMap/></div>

    <section className="hub-model" id="how-it-works" aria-labelledby="hub-heading">
      <div className="hub-intro"><p className="section-label">The hub model</p><h2 id="hub-heading">Care is closer than it looks.</h2><p>One access model, designed for the places people already know and trust.</p></div>
      <div className="hub-list">{hubs.map(({icon:Icon,title,copy})=><article key={title}><span className="hub-icon"><Icon size={42} weight="light" aria-hidden="true"/></span><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div>
    </section>

    <section className="resident-section" id="resident" aria-labelledby="resident-heading">
      <div className="resident-story"><p className="section-label light">Resident access</p><h2 id="resident-heading">One clear next step.<br/>In your language.</h2><p>Residents can speak, tap, or type to find a pathway, check in at a hub, and connect through a provider&rsquo;s existing platform. The experience collects only what is needed and never gives clinical advice.</p><div className="trust-list"><span><MicrophoneStage size={20} aria-hidden="true"/>Voice or text</span><span><Translate size={20} aria-hidden="true"/>Language access</span><span><LockKey size={20} aria-hidden="true"/>Private reset</span></div><a href="#find-access">Explore your county <ArrowRight size={15} aria-hidden="true"/></a></div>
      <ResidentDemo/>
    </section>

    <section className="journey-film" aria-labelledby="journey-film-heading">
      <div className="journey-film-copy">
        <p className="section-label">See the resident journey</p>
        <h2 id="journey-film-heading">A voice-led path from question to connection.</h2>
        <p>Meet Maya and see how a resident can describe what they need, find a nearby access pathway, and prepare to connect with a state-licensed provider.</p>
        <div className="journey-downloads" aria-label="Download resident journey video">
          <a href="/media/resident-journey-youtube.mp4" download>YouTube <DownloadSimple size={15} aria-hidden="true"/></a>
          <a href="/media/resident-journey-x.mp4" download>X <DownloadSimple size={15} aria-hidden="true"/></a>
          <a href="/media/resident-journey-linkedin.mp4" download>LinkedIn <DownloadSimple size={15} aria-hidden="true"/></a>
          <a href="/media/resident-journey-instagram.mp4" download>Instagram <DownloadSimple size={15} aria-hidden="true"/></a>
        </div>
      </div>
      <div className="journey-player">
        <video controls preload="metadata" poster="/media/resident-journey-youtube.png" aria-label="Resident voice journey demonstration">
          <source src="/media/resident-journey-youtube.mp4" type="video/mp4"/>
          <track kind="captions" src="/media/resident-journey-captions.vtt" srcLang="en" label="English" default/>
          Your browser does not support embedded video. <a href="/media/resident-journey-youtube.mp4" download>Download the resident journey video.</a>
        </video>
        <p>Demonstration only. SozoRock Health provides access navigation, not clinical advice or emergency services.</p>
      </div>
    </section>

    <section className="partner-model" id="providers" aria-labelledby="provider-heading">
      <div className="partner-photo" role="img" aria-label="A rural road connecting distant communities"><div><span>BYOP</span><strong>Providers keep their platform.</strong></div></div>
      <div className="partner-copy"><p className="section-label">For licensed providers</p><h2 id="provider-heading">Expand access.<br/>Keep what works.</h2><p>Bring Your Own Platform connects residents to a provider&rsquo;s established clinical system. SozoRock handles the access pathway; the provider remains responsible for care.</p><ul className="readiness-list">{providerSteps.map(({icon:Icon,title,copy})=><li key={title}><Icon size={25} aria-hidden="true"/><span><strong>{title}</strong><small>{copy}</small></span></li>)}</ul><a className="primary-action dark" href="#partner">Begin provider readiness <ArrowRight size={15} aria-hidden="true"/></a></div>
    </section>

    <section className="county-story" id="counties" aria-labelledby="county-heading">
      <div className="county-heading"><div><p className="section-label light">CB-CAP county intelligence</p><h2 id="county-heading">From fragmented reports to systems intelligence.</h2></div><p>CB-CAP turns protected, aggregated access activity into a clearer picture of where communities need hubs, language support, providers, and follow-through.</p></div>
      <div className="county-preview"><div className="county-preview-top"><strong>CB-CAP</strong><span>Sample view · No personal records</span><a href={cbcapUrl}>Explore CB-CAP <ArrowSquareOut size={14} aria-hidden="true"/></a></div><div className="capability-row"><div><span>Filter</span><strong>Every U.S. geography</strong><small>State, county, ZIP, hub type, language, and period</small></div><div><span>Compare</span><strong>Patterns over time</strong><small>See access pathways and community barriers</small></div><div><span>Protect</span><strong>Privacy thresholds</strong><small>Small groups are suppressed before reporting</small></div><div><span>Download</span><strong>Decision-ready reports</strong><small>Accessible CSV and PDF exports for approved users</small></div></div><div className="chart-row"><div className="chart-copy"><ChartLineUp size={38} aria-hidden="true"/><h3>Visualize, compare, and act</h3><p>The public preview explains the capability. County access is approved through an interest and readiness process.</p><a href={cbcapUrl}>View the sample dashboard <ArrowRight size={14} aria-hidden="true"/></a></div><figure className="mini-chart"><figcaption>Sample access pattern — not live county data</figcaption><div aria-hidden="true"><i style={{height:"32%"}}/><i style={{height:"47%"}}/><i style={{height:"44%"}}/><i style={{height:"65%"}}/><i style={{height:"58%"}}/><i style={{height:"79%"}}/><i style={{height:"73%"}}/><i style={{height:"92%"}}/></div><p className="sr-only">A sample bar chart demonstrates how access activity can be compared over time. It does not contain live county data.</p></figure></div></div>
    </section>

    <section className="ai-layer" id="technology" aria-labelledby="technology-heading">
      <div><p className="section-label">AI-native access</p><h2 id="technology-heading">AI where it removes a barrier. Human judgment where it matters.</h2></div>
      <div className="ai-principles"><article><MicrophoneStage size={32} aria-hidden="true"/><h3>Live voice</h3><p>Voice intake is available in resident pathways, with interruption handling and a text option at every step.</p></article><article><Translate size={32} aria-hidden="true"/><h3>Translation</h3><p>English and Spanish are supported from launch, with additional languages added responsibly.</p></article><article><UsersThree size={32} aria-hidden="true"/><h3>Guided AI support</h3><p>Purpose-built assistance helps people navigate access. It never diagnoses, prescribes, or replaces a provider.</p></article><article><Scales size={32} aria-hidden="true"/><h3>Human oversight</h3><p>Residents choose how to proceed, providers remain responsible for care, and authorized people remain accountable.</p></article></div>
    </section>

    <section className="publications" id="publications" aria-labelledby="publication-heading">
      <div className="publication-heading"><p className="section-label">The ideas beneath the infrastructure</p><h2 id="publication-heading">Built from a body of work.</h2><p>Oluwabiyi Adeyemo&rsquo;s publications move rural equity from isolated programs toward durable access and accountable systems intelligence.</p></div>
      <div className="publication-grid"><article><a className="cover" href="/publications/rural-equity-blueprint-volume-1.pdf" aria-label="Open Rural Equity Blueprint Series, Volume 1: Access Day"><img src="/publications/covers/rural-equity-blueprint-volume-1.png" alt="Cover of Rural Equity Blueprint Series, Volume 1: Access Day" loading="lazy"/></a><div><span>Rural Equity Blueprint Series</span><h3>Volume 1: Access Day</h3><p>The hub model, readiness, workforce renewal, literacy, and practical activation.</p><a href="/publications/rural-equity-blueprint-volume-1.pdf" download>Download the publication <DownloadSimple size={15} aria-hidden="true"/></a></div></article><article><a className="cover" href="/publications/rethinking-rural-governance-volume-1.pdf" aria-label="Open Rethinking Rural Governance, Volume 1"><img src="/publications/covers/rethinking-rural-governance-volume-1.png" alt="Cover of Rethinking Rural Governance, Volume 1" loading="lazy"/></a><div><span>Rethinking Rural Governance</span><h3>From Compliance to Systems Intelligence</h3><p>The governance foundation for CB-CAP: proactive, transparent, and designed to help communities act.</p><a href="/publications/rethinking-rural-governance-volume-1.pdf" download>Download the publication <DownloadSimple size={15} aria-hidden="true"/></a></div></article></div>
    </section>

    <section className="about" id="about" aria-labelledby="about-heading"><p className="section-label light">About SozoRock Health</p><div><h2 id="about-heading">National in scope.<br/>Local in activation.</h2><p>SozoRock Health is an initiative of The SozoRock Foundation, Inc., based in New York and designed for every U.S. state and county. Availability follows local interest, verified provider licensure, hub readiness, and responsible launch safeguards.</p></div></section>

    <section className="partner-section" id="partner" aria-labelledby="partner-heading"><div><p className="section-label">Get involved</p><h2 id="partner-heading">Where should access begin?</h2><p>Tell us about your community, provider network, library, institution, or county. We will respond with the right readiness path.</p><a href="mailto:contact@sozorockfoundation.org"><EnvelopeSimple size={16} aria-hidden="true"/>contact@sozorockfoundation.org</a></div><ContactForm/></section>

    <footer className="site-footer"><div className="footer-main"><div><a className="brand-lockup footer-brand" href="#top" aria-label="SozoRock Health home"><span className="wordmark-image"><img src="/brand/sozorock-wordmark-transparent.png" alt="SozoRock"/><sup aria-label="registered trademark">®</sup></span><span>HEALTH</span></a><p>A national, AI-native, non-clinical access infrastructure.</p></div><div className="footer-links"><div><h2>SozoRock Health</h2><a href="#how-it-works">How it works</a><a href="#resident">For residents</a><a href="#providers">For providers</a><a href="#counties">For counties</a></div><div><h2>Foundation</h2><a href="https://sozorockfoundation.org/about-us" target="_blank" rel="noreferrer">About the Foundation <ArrowSquareOut size={12} aria-hidden="true"/></a><a href="https://sozorockfoundation.org/program" target="_blank" rel="noreferrer">Programs <ArrowSquareOut size={12} aria-hidden="true"/></a><a href="https://sozorockfoundation.org/policies" target="_blank" rel="noreferrer">Privacy, accessibility & policies <ArrowSquareOut size={12} aria-hidden="true"/></a><a href="#partner">Contact</a></div><div><h2>Connect</h2><a href="https://x.com/srockfoundation" target="_blank" rel="noreferrer"><XLogo size={17} aria-hidden="true"/>X @srockfoundation</a><a href="https://www.youtube.com/@srockfoundation" target="_blank" rel="noreferrer"><YoutubeLogo size={17} aria-hidden="true"/>YouTube</a><a href="https://www.instagram.com/srockfoundation/" target="_blank" rel="noreferrer"><InstagramLogo size={17} aria-hidden="true"/>Instagram</a><a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fhealth.sozorockfoundation.org" target="_blank" rel="noreferrer"><LinkedinLogo size={17} aria-hidden="true"/>Share on LinkedIn</a><a href="https://sozorockfoundation.org" target="_blank" rel="noreferrer"><GlobeHemisphereWest size={17} aria-hidden="true"/>www.sozorockfoundation.org</a></div></div></div><div className="footer-legal"><p>SozoRock® is a registered trademark of SozoRock Tech Inc., used under license by The SozoRock Foundation.</p><p>The SozoRock Foundation, Inc. is a nonprofit, tax-exempt charitable organization under Section 501(c)(3) of the Internal Revenue Code.</p><small>© {new Date().getFullYear()} The SozoRock Foundation, Inc. All rights reserved.</small></div></footer>
  </main>;
}
