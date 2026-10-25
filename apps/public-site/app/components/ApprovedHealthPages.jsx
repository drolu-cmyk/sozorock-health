import { PrimaryCareAccessPage } from "./PrimaryCareAccessPage";
import { HealthStory } from "./HealthStory";
import { DataPage } from "./DataPage";
import { WorkPage } from "./WorkPage";
import { ProgramInterestForm } from "./ProgramInterestForm";
import { AudienceContact } from "./AudienceContact";
import { HealthHeader } from "./HealthHeader";
import { HealthSiteFooter } from "./HealthSiteFooter";
function Content({pathname,initialInterest,initialLocation}){switch(pathname){
case "/": return <HealthStory />;
case "/primary-care-access": return <PrimaryCareAccessPage />;
case "/es/primary-care-access": return <PrimaryCareAccessPage spanish />;
case "/work": return <WorkPage />;
case "/evidence": return <DataPage />;
case "/contact": return <div className="hx">
<section className="hx-hero hx-wrap" aria-labelledby="hx-title"><p className="hx-label">Work with us</p><h1 id="hx-title">Bring care closer to the people you serve.</h1><p className="hx-promise">Choose who you are. We reply by email.</p></section>
<AudienceContact initialAudience={initialInterest} initialLocation={initialLocation} />
</div>;
case "/interest": return <>
<section className="hero blue"><div className="shell"><h1>{"Join the Primary Care Access Program interest list."}</h1><p>{"Tell us how to reach you. We will contact people on the list about eligibility and next steps for the cohort beginning January 2027. Joining the list does not enroll you or guarantee a place."}</p></div></section>
<section className="section formsection"><div className="shell formlayout"><div className="formheading"><h2>{"Your contact information"}</h2><p>{"Provide your contact details to receive information about eligibility and next steps."}</p><p className="fine">{"Children under 13 should not submit this form. A parent or guardian can contact us about next steps without sending the child's personal or health details."}</p><a className="textlink" href="mailto:contact@sozorockfoundation.org">{"contact@sozorockfoundation.org"}</a><p className="fine"><a href="/privacy#program-interest">{"Read the interest list privacy notice"}</a></p></div><ProgramInterestForm /></div></section>
</>;
default:return null;}}
/** @param {{pathname:string,initialInterest?:string,initialLocation?:string,children?:import("react").ReactNode,spanish?:boolean}} props */
export function ApprovedHealthPage({pathname,initialInterest="",initialLocation="",children=null,spanish=false}){return <div className="approved-site health-system"><a className="hs-skip" href="#health-main">{spanish?"Saltar al contenido":"Skip to content"}</a><HealthHeader spanish={spanish} path={pathname} /><main id="health-main">{children ?? <Content pathname={pathname} initialInterest={initialInterest} initialLocation={initialLocation}/>}</main><HealthSiteFooter spanish={spanish} path={pathname} />
</div>}
