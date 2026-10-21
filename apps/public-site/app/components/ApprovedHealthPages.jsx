import { AccessBarriers } from "./AccessBarriers";
import { ProgramInterestForm } from "./ProgramInterestForm";
import { ContactForm } from "./ContactForm";
import { HealthHeader } from "./HealthHeader";
function Content({pathname,initialInterest,initialLocation}){switch(pathname){
case "/": return <>
<section className="hero blue"><div className="shell"><h1>{"Care. For every ZIP Code."}</h1>
<p>{"The Primary Care Access Program, proposed Health Equity Hubs and county evidence for community health access."}</p>
<div className="hs-actions"><a className="action" href="/interest">{"Join the interest list"}</a><a className="action" href="https://www.sozorockfoundation.org/partner">{"Partner"}</a></div>
</div>
</section>
<section className="section soft" id="primary-care-access"><div className="shell split"><h2>{"Primary Care Access Program"}</h2>
<div><p>{"Beginning January 2027, the Foundation will sponsor 12 months of primary care support for up to 25 New Yorkers, one per household. Participants are 64 or younger, have financial need and live with a chronic condition such as diabetes or high blood pressure, in any of New York's 62 counties."}</p>
<p>{"Each participant receives a sponsored direct primary care membership with Dr. Michael Purcell and Purcell Integrative Osteopathic Care, a direct primary care practice in Clifton Park, plus ongoing telehealth, help with transportation and health access education."}</p>
<p>{"Starting with up to 25 keeps the first cohort small enough to show where the pathway works, where it fails and what should change before expansion."}</p>
<p className="fine">{"Part of the SozoRock Health Equity Initiative. Clinical care remains with the licensed provider. Membership is not health insurance."}</p>
<div className="hs-actions"><a className="action" href="/interest">{"Join the interest list"}</a><a className="action" href="https://www.sozorockfoundation.org/support">{"Sponsor a participant"}</a></div>
<p className="fine">{"$4,320 supports one New Yorker for a full year."}</p>
</div></div></section>
<section className="section program-film" aria-labelledby="care-film-title"><div className="shell">
<h2 id="care-film-title">Care Within Reach</h2>
<video controls playsInline preload="none" poster="/media/care-within-reach.poster.jpg" aria-label="Care Within Reach, a one-minute introduction to the Primary Care Access Program">
<source src="/media/care-within-reach.web.mp4" type="video/mp4" />
<track kind="captions" src="/media/care-within-reach.en.vtt" srcLang="en" label="English" />
</video>
<p className="fine"><a href="/media/care-within-reach.transcript.txt">Read the descriptive transcript</a></p>
</div></section>
<section className="section"><div className="shell"><p>{"The Fireside and the Working Roundtable: a planned series on rural health transformation, measured locally. Dates, locations and participants will appear when confirmed."}</p><a className="textlink" href="https://www.sozorockfoundation.org/events">{"Roundtables and briefings"}</a></div></section>
<AccessBarriers />
<section className="section soft" id="hubs"><div className="shell"><div className="hubintro"><h2>{"Health Equity Initiative"}</h2>
<p>{"Health literacy, digital readiness and preparation for provider-led care. Three models, designed for the places people use."}</p>
</div>
<div className="hubset"><article><h3>{"Proposed: Library Health Equity Hub"}</h3>
<p>{"Health literacy and digital support through local libraries."}</p>
<details><summary>{"Details"}</summary>
<p>{"A proposed library-based model for health information, digital skills and preparation to use provider-led services. Local partners would agree the space, connectivity, privacy and staff responsibilities."}</p>
</details>
</article>
<article><h3>{"Proposed: Community Health Equity Hub"}</h3>
<p>{"Health education and digital support through community organizations."}</p>
<details><summary>{"Details"}</summary>
<p>{"A proposed community-based model combining local health information, digital support and preparation for provider-led services. Activities would reflect local needs, partner capacity and available services."}</p>
</details>
</article>
<article><h3>{"Proposed: Home Health Equity Hub"}</h3>
<p>{"Help preparing to use provider platforms from home."}</p>
<details><summary>{"Details"}</summary>
<p>{"A proposed home-based model for people who need support using devices, connectivity or provider platforms. It does not establish a home-care or home-health clinical service."}</p>
</details>
</article>
</div>
<p className="modelnote">{"Proposed partner models. Local implementation depends on agreed responsibilities, available services and delivery capacity. Clinical care remains with licensed providers."}</p>
</div>
</section>
<section className="section"><div className="shell focusgrid"><article><h2>{"Proposed: Health Access Day"}</h2>
<p>{"A proposed community format for health education and health literacy, with locally agreed activities and follow-up."}</p>
</article>
<article><h2>{"Provider partnerships"}</h2>
<p>{"Bring Your Own Platform keeps clinical systems, records, consent and medical decisions with the provider. SozoRock supports nonclinical readiness and coordination."}</p>
</article>
</div>
</section>
<section className="section soft"><div className="shell"><div className="split"><h2>{"County health data"}</h2>
<div><p>{"Place Intelligence is public county data on health, community and workforce conditions. CB-CAP is a county planning workspace that links that evidence to access planning."}</p>
</div>
</div>
<div style={{"marginTop": "35px"}}><div className="datahead"><h3>{"Albany County, New York"}</h3>
<span>{"County FIPS 36001 · 2023 estimates · 2025 release"}</span>
</div>
<div className="datastrip"><div><strong>{"5.5%"}</strong>
<span>{"Adults aged 18–64 without health insurance"}</span>
<small>{"95% confidence interval: 4.2–7.0%"}</small>
</div>
<div><strong>{"7.2%"}</strong>
<span>{"Lack of reliable transportation"}</span>
<small>{"95% confidence interval: 6.1–8.5%"}</small>
</div>
<div><strong>{"12.2%"}</strong>
<span>{"Food insecurity"}</span>
<small>{"95% confidence interval: 9.9–15.0%"}</small>
</div>
</div>
<p className="sources">{"Source: CDC PLACES, 2025 release. Model-based crude prevalence estimates for 2023. Insurance covers adults aged 18–64; other measures cover adults aged 18 or older. County estimates describe community conditions, not SozoRock results or an individual’s needs."} <a href="https://data.cdc.gov/d/i46a-9kgh">CDC dataset</a>{" · "}<a href="/sources/albany-places-2025.json">Albany source data</a></p>
<a className="textlink" href="/evidence">{"Explore"}</a>
</div>
</div>
</section>
<section className="section"><div className="shell"><h2>{"Digital readiness and workforce development."}</h2>
<div className="rows"><article><h3>{"Devices, connectivity and skills"}</h3>
<div><p>{"Practical preparation to use available services. Voice, text and touch options need consent, accessible alternatives and clear handling of personal information."}</p>
</div>
</article>
<article><h3>{"Local workforce"}</h3>
<div><p>{"Collaborate with educators, employers and community institutions on the skills and capacity a place needs. Training, credentials and licensure stay with the responsible institutions."}</p>
</div>
</article>
<article><h3>{"Research and applied learning"}</h3>
<div><p>{"Connect health-access planning with REBS, RRG and HSA research, the SozoRock AI Lab and recurring graduate cybersecurity projects."}</p>
</div>
</article>
</div>
<a className="textlink" href="https://www.sozorockfoundation.org/partner">{"Partner"}</a>
</div>
</section>
</>;
case "/work": return <>
<section className="hero blue"><div className="shell"><h1>{"The Health Equity Initiative"}</h1>
<p>{"Health literacy, digital readiness and preparation for provider-led care—in libraries, communities and homes."}</p>
<a className="action" href="https://www.sozorockfoundation.org/partner">{"Partner"}</a>
</div>
</section>
<section className="section" id="hubs"><div className="shell"><div className="hubset"><article><h3>{"Proposed: Library Health Equity Hub"}</h3>
<p>{"Health literacy and digital support through local libraries."}</p>
<details><summary>{"Details"}</summary>
<p>{"A proposed library-based model for health information, digital skills and preparation to use provider-led services. Local partners would agree the space, connectivity, privacy and staff responsibilities."}</p>
</details>
</article>
<article><h3>{"Proposed: Community Health Equity Hub"}</h3>
<p>{"Health education and digital support through community organizations."}</p>
<details><summary>{"Details"}</summary>
<p>{"A proposed community-based model combining local health information, digital support and preparation for provider-led services. Activities would reflect local needs, partner capacity and available services."}</p>
</details>
</article>
<article><h3>{"Proposed: Home Health Equity Hub"}</h3>
<p>{"Help preparing to use provider platforms from home."}</p>
<details><summary>{"Details"}</summary>
<p>{"A proposed home-based model for people who need support using devices, connectivity or provider platforms. It does not establish a home-care or home-health clinical service."}</p>
</details>
</article>
</div>
<p className="modelnote">{"Proposed partner models. Local implementation depends on agreed responsibilities, available services and delivery capacity. Clinical care remains with licensed providers."}</p>
</div>
</section>
<section className="section soft"><div className="shell focusgrid"><article><h2>{"Proposed: Health Access Day"}</h2>
<p>{"A proposed community format for health education and health literacy, with locally agreed activities and follow-up."}</p>
</article>
<article><h2>{"Provider partnerships"}</h2>
<p>{"Bring Your Own Platform keeps clinical systems, records, consent and medical decisions with the provider. SozoRock supports nonclinical readiness and coordination."}</p>
</article>
</div>
</section>
<section className="section"><div className="shell"><div className="split"><h2>{"County health data"}</h2>
<div><p>{"Place Intelligence is public county data on health, community and workforce conditions. CB-CAP is a county planning workspace that links that evidence to access planning."}</p>
</div>
</div>
<div style={{"marginTop": "35px"}}><div className="datahead"><h3>{"Albany County, New York"}</h3>
<span>{"County FIPS 36001 · 2023 estimates · 2025 release"}</span>
</div>
<div className="datastrip"><div><strong>{"5.5%"}</strong>
<span>{"Adults aged 18–64 without health insurance"}</span>
<small>{"95% confidence interval: 4.2–7.0%"}</small>
</div>
<div><strong>{"7.2%"}</strong>
<span>{"Lack of reliable transportation"}</span>
<small>{"95% confidence interval: 6.1–8.5%"}</small>
</div>
<div><strong>{"12.2%"}</strong>
<span>{"Food insecurity"}</span>
<small>{"95% confidence interval: 9.9–15.0%"}</small>
</div>
</div>
<p className="sources">{"Source: CDC PLACES, 2025 release. Model-based crude prevalence estimates for 2023. Insurance covers adults aged 18–64; other measures cover adults aged 18 or older. County estimates describe community conditions, not SozoRock results or an individual’s needs."} <a href="https://data.cdc.gov/d/i46a-9kgh">CDC dataset</a>{" · "}<a href="/sources/albany-places-2025.json">Albany source data</a></p>
<a className="textlink" href="/evidence">{"Explore"}</a>
</div>
</div>
</section>
<section className="section soft"><div className="shell split"><h2>{"Primary Care Access Program"}</h2>
<div><p>{"Beginning January 2027, the Foundation will sponsor 12 months of primary care support for up to 25 New Yorkers, one per household. Participants are 64 or younger, have financial need and live with a chronic condition such as diabetes or high blood pressure, in any of New York's 62 counties."}</p>
<p>{"Each participant receives a sponsored direct primary care membership with Dr. Michael Purcell and Purcell Integrative Osteopathic Care, a direct primary care practice in Clifton Park, plus ongoing telehealth, help with transportation and health access education."}</p>
<p>{"Starting with up to 25 keeps the first cohort small enough to show where the pathway works, where it fails and what should change before expansion."}</p>
<p className="fine">{"Part of the SozoRock Health Equity Initiative. Clinical care remains with the licensed provider. Membership is not health insurance."}</p>
<div className="hs-actions"><a className="action" href="/interest">{"Join the interest list"}</a><a className="action" href="https://www.sozorockfoundation.org/support">{"Sponsor a participant"}</a></div>
<p className="fine">{"$4,320 supports one New Yorker for a full year."}</p>
</div></div></section>
<section className="section"><div className="shell"><p>{"The Fireside and the Working Roundtable: a planned series on rural health transformation, measured locally. Dates, locations and participants will appear when confirmed."}</p><a className="textlink" href="https://www.sozorockfoundation.org/events">{"Roundtables and briefings"}</a></div></section>
<section className="section soft"><div className="shell"><h2>{"Digital readiness and workforce development."}</h2>
<div className="rows"><article><h3>{"Devices, connectivity and skills"}</h3>
<div><p>{"Practical preparation to use available services. Voice, text and touch options need consent, accessible alternatives and clear handling of personal information."}</p>
</div>
</article>
<article><h3>{"Local workforce"}</h3>
<div><p>{"Collaborate with educators, employers and community institutions on the skills and capacity a place needs. Training, credentials and licensure stay with the responsible institutions."}</p>
</div>
</article>
<article><h3>{"Research and applied learning"}</h3>
<div><p>{"Connect health-access planning with REBS, RRG and HSA research, the SozoRock AI Lab and recurring graduate cybersecurity projects."}</p>
</div>
</article>
</div>
<a className="textlink" href="https://www.sozorockfoundation.org/partner">{"Partner"}</a>
</div>
</section>
</>;
case "/evidence": return <>
<section className="hero blue"><div className="shell"><h1>{"Local data for health-access decisions."}</h1>
<p>{"Explore health, community and workforce evidence. Use local knowledge to decide what comes next."}</p>
</div>
</section>
<section className="section"><div className="shell focusgrid"><article><h2>{"Place Intelligence"}</h2>
<p>{"Place Intelligence is public county data on health, community and workforce conditions. Search by county, city or ZIP Code. Review health measures, community conditions and workforce information alongside definitions, sources and dates."}</p>
<p className="fine">{"City and ZIP searches resolve to county evidence; overlapping boundaries require a geography choice."}</p>
<a className="textlink" href="/explore" target="_blank" rel="noopener">{"Explore"}</a>
</article>
<article><h2>{"CB-CAP"}</h2>
<p>{"CB-CAP is a county planning workspace that links that evidence to access planning. The County-Based Community Access Platform includes proposed institutional workflows for community health assessments, improvement plans, funding and workforce."}</p>
<p className="fine">{"Public preview open. Institutional workflows require activation and are not currently available."}</p>
<a className="textlink" href="https://cbcap.sozorockfoundation.org/" target="_blank" rel="noopener">{"Explore"}</a>
</article>
</div>
</section>
<section className="section soft"><div className="shell"><h2>{"See what the data includes."}</h2>
<div className="datahead"><h3>{"Albany County, New York"}</h3>
<span>{"County FIPS 36001 · 2023 estimates · 2025 release"}</span>
</div>
<div className="datastrip"><div><strong>{"5.5%"}</strong>
<span>{"Adults aged 18–64 without health insurance"}</span>
<small>{"95% confidence interval: 4.2–7.0%"}</small>
</div>
<div><strong>{"7.2%"}</strong>
<span>{"Lack of reliable transportation"}</span>
<small>{"95% confidence interval: 6.1–8.5%"}</small>
</div>
<div><strong>{"12.2%"}</strong>
<span>{"Food insecurity"}</span>
<small>{"95% confidence interval: 9.9–15.0%"}</small>
</div>
</div>
<p className="sources">{"Source: CDC PLACES, 2025 release. Model-based crude prevalence estimates for 2023. Insurance covers adults aged 18–64; other measures cover adults aged 18 or older. County estimates describe community conditions, not SozoRock results or an individual’s needs."} <a href="https://data.cdc.gov/d/i46a-9kgh">CDC dataset</a>{" · "}<a href="/sources/albany-places-2025.json">Albany source data</a></p>
<details className="dataextras"><summary>{"More access indicators"}</summary>
<table className="evidencetable"><thead><tr><th>{"County measure"}</th>
<th>{"Estimate"}</th>
<th>{"95% confidence interval"}</th>
</tr>
</thead>
<tbody><tr><td>{"Housing insecurity"}</td>
<td>{"10.8%"}</td>
<td>{"9.0–12.9%"}</td>
</tr>
<tr><td>{"Utility shutoff threat"}</td>
<td>{"6.6%"}</td>
<td>{"5.5–7.9%"}</td>
</tr>
<tr><td>{"Any disability"}</td>
<td>{"25.9%"}</td>
<td>{"22.3–29.8%"}</td>
</tr>
<tr><td>{"Loneliness"}</td>
<td>{"36.1%"}</td>
<td>{"31.9–40.7%"}</td>
</tr>
</tbody>
</table>
<p className="sources">{"Same county and 2022–2023 period as the example above. Local planning priorities require local evidence and review; the live page has no verified current local plan for this county."}</p>
</details>
<a className="textlink" href="/explore?kind=county&geoid=36001&view=brief" target="_blank" rel="noopener">{"Explore"}</a>
</div>
</section>
<section className="section"><div className="shell"><h2>{"Health, community and workforce data"}</h2>
<div className="rows"><article><h3>{"Health and access"}</h3>
<div><p>{"Access barriers, chronic conditions and prevention measures. Explore 21 health measures alongside community context."}</p>
</div>
</article>
<article><h3>{"Community conditions"}</h3>
<div><p>{"Community-Level Health Database and American Community Survey evidence. Retain geography, period, definitions and data availability."}</p>
</div>
</article>
<article><h3>{"Workforce and shortages"}</h3>
<div><p>{"Health Professional Shortage Areas, Medically Underserved Areas and Populations, and Area Health Resources Files. Review designation dates and source limitations."}</p>
</div>
</article>
<article><h3>{"Maps, comparisons and planning"}</h3>
<div><p>{"Use Brief, Map, Action and Visuals views to compare counties, inspect sources, share findings and download evidence. Comparisons are contextual and may not be official state or national estimates."}</p>
</div>
</article>
</div>
<a className="textlink" href="/explore" target="_blank" rel="noopener">{"Explore"}</a>
</div>
</section>
<section className="section soft"><div className="shell split"><h2>{"Health equity research"}</h2>
<div><p>{"REBS, RRG and HSA examine rural health equity, governance and digital health systems. Read the publication before adapting a proposed model."}</p>
<a className="textlink" href="https://www.sozorockfoundation.org/publications">{"Read"}</a>
</div>
</div>
</section>
</>;
case "/contact": return <>
<section className="hero blue"><div className="shell"><h1>{"Contact SozoRock Health."}</h1>
<p>{"Ask a question about SozoRock Health or how to get involved."}</p>
</div>
</section>
<section className="section formsection" id="inquiry"><div className="shell formlayout"><div className="formheading"><h2>{"Get in touch"}</h2>
<p>{"Tell us how we can help with your inquiry."}</p>
<p className="fine">{"Do not include medical records, symptoms or urgent health information."}</p>
<a className="textlink" href="mailto:contact@sozorockfoundation.org">{"contact@sozorockfoundation.org"}</a>
</div>
<ContactForm initialInterest={initialInterest} initialLocation={initialLocation} /></div>
</section>
</>;
case "/interest": return <>
<section className="hero blue"><div className="shell"><h1>{"Join the Primary Care Access Program interest list."}</h1><p>{"Tell us how to reach you. We will contact people on the list about eligibility and next steps for the cohort beginning January 2027. Joining the list does not enroll you or guarantee a place."}</p></div></section>
<section className="section formsection"><div className="shell formlayout"><div className="formheading"><h2>{"Your contact information"}</h2><p>{"Provide your contact details to receive information about eligibility and next steps."}</p><p className="fine">{"Children under 13 should not submit this form. A parent or guardian can contact us about next steps without sending the child's personal or health details."}</p><a className="textlink" href="mailto:contact@sozorockfoundation.org">{"contact@sozorockfoundation.org"}</a><p className="fine"><a href="/privacy#program-interest">{"Read the interest list privacy notice"}</a></p></div><ProgramInterestForm /></div></section>
</>;
default:return null;}}
export function ApprovedHealthPage({pathname,initialInterest="",initialLocation=""}){return <div className="approved-site health-system"><a className="hs-skip" href="#health-main">Skip to content</a><HealthHeader /><main id="health-main"><Content pathname={pathname} initialInterest={initialInterest} initialLocation={initialLocation}/></main><footer className="footer"><div className="shell"><div className="footertop"><a className="brand" href="https://www.sozorockfoundation.org/">{"The"}<strong>{"SozoRock."}</strong>
{"Foundation"}</a>
<nav aria-label="Work"><a className="" href="https://www.sozorockfoundation.org/platforms">{"What we do"}</a>
<a className="" href="https://www.sozorockfoundation.org/publications">{"Publications"}</a>
<a className="" href="https://www.sozorockfoundation.org/events">{"Roundtables"}</a>
<a className="" href="/">{"SozoRock Health"}</a>
<a className="" href="https://cbcap.sozorockfoundation.org/" target="_blank" rel="noopener">{"CB-CAP"}</a>
<a className="" href="https://www.sozorockfoundation.org/ai-society">{"AI and Society"}</a>
</nav>
<nav aria-label="Foundation"><a className="" href="https://www.sozorockfoundation.org/about">{"Who we are"}</a>
<a className="" href="https://www.sozorockfoundation.org/leadership">{"Leadership"}</a>
<a className="" href="https://www.sozorockfoundation.org/partner">{"Partner"}</a>
<a className="" href="https://www.sozorockfoundation.org/contact">{"Contact"}</a>
</nav>
</div>
<div className="footerlegal"><p>{"The SozoRock Foundation, Inc. · 501(c)(3) public charity"}<br />{"EIN 39-4736725"}</p>
<nav aria-label="Policies"><a className="" href="/privacy">{"Privacy"}</a>
<a className="" href="/terms">{"Terms"}</a>
<a className="" href="/accessibility">{"Accessibility"}</a>
<a className="" href="/nondiscrimination">{"Nondiscrimination"}</a>
<a className="" href="https://www.sozorockfoundation.org/standards">{"Standards"}</a>
</nav>
</div>
<p className="copyright">{"© 2026 The SozoRock Foundation, Inc."}</p>
</div>
</footer>
</div>}
