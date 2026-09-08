import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { HealthShell } from "../components/HealthShell";
import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
export const metadata = healthMetadata(
  "Our work",
  "Explore Health Equity Hubs, Health Access Day, place-based evidence, digital readiness and workforce partnerships through SozoRock Health.",
  "/work",
);
const areas = [
  {
    id: "community-access",
    title: "Community access",
    intro:
      "Bring practical support closer to the places people already use. Health Equity Hubs and Health Access Day provide models for partners to adapt to local needs.",
    parts: [
      [
        "Health Equity Hubs",
        "Library, community and home-based formats bring together digital readiness, local information and preparation for provider-led services. A hub does not become a clinic.",
      ],
      [
        "Health Access Day",
        "A focused community activation shaped by local evidence. Partners define the place, purpose and support required; any clinical activity belongs to appropriately licensed professionals.",
      ],
    ],
    action: "Discuss a community access model",
    href: "/contact?interest=Health%20Equity%20Hub%20partnership",
  },
  {
    id: "evidence-intelligence",
    title: "Evidence and intelligence",
    intro:
      "Understand the conditions around access before choosing a response. Place Intelligence connects geographic context with indicators, definitions and sources. Research gives institutions frameworks for examining access, governance and assurance.",
    parts: [
      [
        "County-level planning",
        "CB-CAP is a related Foundation product for county-level planning. It has its own product experience and scope.",
      ],
    ],
    action: "Explore the evidence pathways",
    href: "/evidence",
  },
  {
    id: "digital-readiness",
    title: "Digital and provider readiness",
    intro:
      "A device, connection or online portal can determine whether someone can take the next step. Our approach brings practical preparation into the access journey.",
    parts: [
      [
        "Provider-led pathways",
        "Bring Your Own Platform means providers retain their clinical systems, records, consent processes and judgment. SozoRock Health works on readiness around that connection.",
      ],
      [
        "Non-clinical interaction",
        "Voice, text and touch can make practical information easier to use. Each experience needs clear consent, accessible alternatives and boundaries around personal health information.",
      ],
    ],
    action: "Discuss a provider partnership",
    href: "/contact?interest=BYOP%20provider%20partnership",
  },
  {
    id: "workforce-capacity",
    title: "Workforce capacity",
    intro:
      "Evidence of local need should inform how skills and capacity develop. We bring workforce questions into conversations with educators, employers and community institutions.",
    parts: [
      [
        "Build the capability a place needs",
        "Training, credentials and licensure remain with the responsible institutions. Partnership work starts with the capability needed and the practical route to building it.",
      ],
    ],
    action: "Discuss a workforce partnership",
    href: "/contact?interest=Workforce%20partnership",
  },
];
export default function WorkPage() {
  return (
    <HealthShell>
      <main id="health-main" className="hs-content">
        <div className="hs-page-heading">
          <div>
            <p className="hs-eyebrow">Our work</p>
            <h1>Access takes more than an appointment.</h1>
          </div>
          <p>
            Transport, technology, local capacity and institutional decisions
            shape whether care is within reach. Our work addresses the systems
            around that journey.
          </p>
        </div>
        {areas.map((area) => (
          <section className="hs-work-row" id={area.id} key={area.id}>
            <h2>{area.title}</h2>
            <div>
              <p>{area.intro}</p>
              {area.parts.map(([heading, text]) => (
                <div key={heading}>
                  <h3>{heading}</h3>
                  <p>{text}</p>
                </div>
              ))}
              <a className="hs-link" href={area.href}>
                {area.action}
                <ArrowRight size={22} aria-hidden="true" />
              </a>
            </div>
          </section>
        ))}
        <aside className="hs-context">
          <h2>Build from the needs of a place.</h2>
          <p>
            These are areas for partnership and implementation, not a directory
            of operating clinics or guaranteed local services. Tell us about
            your community, institution or access challenge. SozoRock Health is
            not a clinic, provider or telehealth platform and does not replace
            licensed practitioners.
          </p>
          <a className="hs-link" href="/contact">
            Start a conversation
            <ArrowRight size={22} aria-hidden="true" />
          </a>
        </aside>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(healthPageSchema("Our work", "/work")),
        }}
      />
    </HealthShell>
  );
}
