const pathways = [
  ["For residents", "Find a care pathway through a hub or your own device."],
  ["For providers", "Keep your platform. Expand access in the states where you are verified."],
  ["For counties", "Move from fragmented numbers to protected access intelligence."],
];

export default function Home() {
  return (
    <main>
      <header className="nav-shell">
        <a className="wordmark" href="#top" aria-label="SozoRock Health home"><img src="/brand/sozorock-wordmark-source.png" alt="SozoRock®" /><span>Health</span></a>
        <nav aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a><a href="#residents">For residents</a><a href="#providers">For providers</a><a href="#counties">For counties</a><a href="#impact">Impact & publications</a><a href="#about">About SozoRock</a>
        </nav>
        <a className="nav-cta" href="#partner">Get involved</a>
      </header>

      <section id="top" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Nationwide access infrastructure</p>
          <h1>Access should not depend on your ZIP code.</h1>
          <p className="lede">SozoRock Health helps residents begin a pathway to licensed care through libraries, community hubs, home-based support, and their own devices.</p>
          <form className="county-search" action="#residents">
            <label htmlFor="county">Explore access in your community</label>
            <div><input id="county" name="county" placeholder="Enter a county or ZIP code" /><button type="submit">Search</button></div>
          </form>
        </div>
        <div className="hero-map" aria-label="United States county access map illustration"><div className="map-grid" /><div className="map-lens"><strong>County readiness</strong><span>Explore local pathways, hubs, and provider availability.</span></div></div>
      </section>

      <section id="how-it-works" className="pathways" aria-label="Choose a pathway">
        {pathways.map(([title, text], index) => <a key={title} href={index === 0 ? "#residents" : index === 1 ? "#providers" : "#counties"}><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p><b>Explore →</b></a>)}
      </section>

      <section id="residents" className="resident-band">
        <div><p className="eyebrow">Built for people</p><h2>Simple enough to start. Strong enough to carry through.</h2><p>Choose a language. Speak or type. Check in at a hub or begin from home. SozoRock Health makes the next step clear without asking residents to navigate the system alone.</p><a href="#partner">Find a hub or care pathway</a></div>
        <div className="tablet" aria-label="Resident tablet experience"><div className="tablet-top"><span>SozoRock Health</span><span>Español</span></div><p>How can we help you today?</p><small>You can speak or tap.</small><div className="voice">◉</div><div className="tablet-actions"><button>Find care</button><button>Check in at a hub</button><button>Get language support</button></div></div>
      </section>

      <section id="counties" className="cbcap">
        <div className="section-intro"><p className="eyebrow">CB-CAP</p><h2>See where access is working—and where a community needs more.</h2><p>CB-CAP helps participating counties turn anonymized access patterns into practical decisions about hubs, language support, and provider pathways.</p></div>
        <div className="dashboard">
          <aside><b>CB-CAP</b><span>Overview</span><span>Access funnel</span><span>Map</span><span>Trends & forecast</span><span>Reports</span></aside>
          <div className="dash-main"><div className="filters"><button>United States</button><button>State</button><button>County</button><button>ZIP code</button><button>Time range</button><button className="apply">Explore patterns</button><button className="export">Export</button><button className="export">Download brief</button></div><div className="dash-grid"><div className="funnel"><h3>Access pathway</h3>{[100,65,42,24,15].map((value, index)=><div key={value}><span style={{width:`${value}%`}} /> <small>{["Community presence","Aware of options","Attempted access","Connected to resource","Follow-up available"][index]}</small></div>)}</div><div className="map-panel"><h3>Access index map</h3><div className="county-map" /></div><div className="trend"><h3>Access over time</h3><svg viewBox="0 0 500 150" aria-label="Access trend chart"><path d="M0 130 C40 120 70 90 110 104 S175 85 220 93 S290 55 330 70 S390 38 430 50 S470 28 500 18" fill="none" stroke="currentColor" strokeWidth="5" /></svg></div><div className="barriers"><h3>Common access barriers</h3>{["Transportation","Cost","Information gap","Digital access","Language"].map((name,index)=><div key={name}><small>{name}</small><span style={{width:`${90-index*13}%`}} /></div>)}</div></div><footer>CB-CAP shows anonymized community patterns—not personal records. <a href="#about">How privacy works →</a></footer></div>
        </div>
      </section>

      <section id="impact" className="impact"><p className="eyebrow">The work behind the platform</p><h2>Access is a system responsibility.</h2><p>SozoRock Health carries forward the work of Oluwabiyi Adeyemo: translating rural equity, accountable governance, and systems intelligence into practical access infrastructure.</p><div className="book-row"><article><span>Rural Equity Blueprint Series</span><h3>Volume 1: Access Day</h3><p>A framework for rural health equity, readiness, and coordinated access.</p></article><article><span>Rethinking Rural Governance</span><h3>Volume 1: From Compliance to Systems Intelligence</h3><p>A case for evidence that helps communities act, not simply report.</p></article></div></section>

      <section id="partner" className="partner"><p className="eyebrow">Partner with SozoRock</p><h2>Build access with your community.</h2><p>For counties, providers, libraries, community organizations, universities, and funders.</p><a href="mailto:contact@sozorockfoundation.org">Start a conversation</a></section>

      <footer id="about" className="site-footer"><span>© {new Date().getFullYear()} The SozoRock Foundation, Inc.</span><span>Non-clinical access infrastructure</span><a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a></footer>
    </main>
  );
}
