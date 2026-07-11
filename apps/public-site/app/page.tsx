import {
  ArrowRight,
  ArrowSquareOut,
  Books,
  Brain,
  Buildings,
  ChartLineUp,
  DownloadSimple,
  EnvelopeSimple,
  FirstAidKit,
  GlobeHemisphereWest,
  GraduationCap,
  HouseLine,
  InstagramLogo,
  LinkedinLogo,
  LockKey,
  MicrophoneStage,
  Network,
  Path,
  Scales,
  ShieldCheck,
  ShieldChevron,
  Translate,
  UsersThree,
  XLogo,
  YoutubeLogo,
} from "@phosphor-icons/react/dist/ssr";
import { ContactForm } from "./components/ContactForm";
import { NationalAccessMap } from "./components/NationalAccessMap";
import { ResidentDemo } from "./components/ResidentDemo";
import { SiteHeader } from "./components/SiteHeader";

const hubs = [
  {
    icon: Books,
    title: "Library Health Equity Hubs",
    copy: "Digital literacy, telehealth preparation, chronic-disease education, and benefits support in a familiar public setting.",
  },
  {
    icon: Buildings,
    title: "Community-Based Health Equity Hubs",
    copy: "Non-clinical readiness and Health Access Day support in trusted community spaces.",
  },
  {
    icon: HouseLine,
    title: "Home-Based Health Equity Hubs",
    copy: "Configured technology and remote support concepts for residents facing mobility, transportation, or digital barriers.",
  },
];

const providerSteps = [
  {
    icon: ShieldCheck,
    title: "State verification",
    copy: "Providers must be licensed for every state they serve.",
  },
  {
    icon: Path,
    title: "Qualified connections",
    copy: "Receive resident requests without rebuilding clinical workflows.",
  },
  {
    icon: Scales,
    title: "Clear boundaries",
    copy: "SozoRock is non-clinical and does not replace professional judgment.",
  },
];

const systems = [
  {
    icon: FirstAidKit,
    title: "Chronic-disease mitigation",
    copy: "Awareness, diabetes education, readiness, and trusted non-clinical support that help communities use existing care and public-health systems.",
  },
  {
    icon: Network,
    title: "Digital navigation",
    copy: "Digital literacy, telehealth preparation, benefits support, and practical pathways through fragmented systems.",
  },
  {
    icon: Brain,
    title: "AI readiness",
    copy: "Bounded AI, Voice Access, workflow design, and human oversight prepared for responsible institutional use.",
  },
  {
    icon: Buildings,
    title: "Public-sector modernization",
    copy: "County intelligence, governance discipline, and planning support for Community Health Assessments and Community Health Improvement Plans.",
  },
  {
    icon: ShieldChevron,
    title: "Cybersecurity readiness",
    copy: "Digital assurance, privacy-preserving architecture, and controls that strengthen trust without weakening human accountability.",
  },
  {
    icon: GraduationCap,
    title: "Workforce development",
    copy: "Interdisciplinary capability for the people and institutions responsible for implementing and sustaining modern systems.",
  },
];

export default function Home() {
  const cbcapUrl = process.env.NEXT_PUBLIC_CBCAP_URL ?? "#counties";
  return (
    <main id="top">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <div id="main-content">
        <NationalAccessMap />
      </div>

      <section
        className="systems-model"
        id="systems"
        aria-labelledby="systems-heading"
      >
        <div className="systems-intro">
          <p className="section-label">One national systems model</p>
          <h2 id="systems-heading">Beyond a single access point.</h2>
          <p>
            SozoRock Health unifies non-clinical health access, workforce
            readiness, and systems infrastructure so individuals, institutions,
            and public agencies can use existing healthcare, public-health,
            digital, and workforce systems more effectively.
          </p>
        </div>
        <div className="systems-grid">
          {systems.map(({ icon: Icon, title, copy }) => (
            <article key={title}>
              <Icon size={31} weight="light" aria-hidden="true" />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="access-day"
        id="health-access-day"
        aria-labelledby="access-day-heading"
      >
        <div>
          <p className="section-label light">Health Access Day</p>
          <h2 id="access-day-heading">
            Public education.
            <br />
            Field readiness.
            <br />
            Trusted activation.
          </h2>
        </div>
        <div>
          <p>
            Health Access Day brings chronic-illness awareness, diabetes
            education, digital navigation, health literacy, and non-clinical
            resident support into trusted community settings.
          </p>
          <p>
            It surfaces barriers, strengthens readiness for provider-led
            services, and connects local institutions around practical action.
            Clinical education or screening, when offered, remains the
            responsibility of licensed professionals acting within their
            credentials and scope.
          </p>
          <a href="#partner">
            Plan a Health Access Day <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section
        className="hub-model"
        id="how-it-works"
        aria-labelledby="hub-heading"
      >
        <div className="hub-intro">
          <p className="section-label">Health Equity Hub family</p>
          <h2 id="hub-heading">Infrastructure built around local life.</h2>
          <p>
            Three deployment formats prepare residents and institutions to use
            existing health, public-health, digital, and community systems more
            effectively.
          </p>
        </div>
        <div className="hub-list">
          {hubs.map(({ icon: Icon, title, copy }) => (
            <article key={title}>
              <span className="hub-icon">
                <Icon size={42} weight="light" aria-hidden="true" />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="resident-section"
        id="resident"
        aria-labelledby="resident-heading"
      >
        <div className="resident-story">
          <p className="section-label light">Resident Access Layer</p>
          <h2 id="resident-heading">
            Know where to start.
            <br />
            Arrive prepared.
          </h2>
          <p>
            Residents can speak, tap, or type to understand local non-clinical
            support, prepare for virtual visits, improve digital readiness,
            locate a Health Equity Hub, and understand provider-led pathways.
            Voice Access never diagnoses, triages symptoms, recommends
            treatment, prescribes medication, or gives medical advice.
          </p>
          <div className="trust-list">
            <span>
              <MicrophoneStage size={20} aria-hidden="true" />
              Voice or text
            </span>
            <span>
              <Translate size={20} aria-hidden="true" />
              Language access
            </span>
            <span>
              <LockKey size={20} aria-hidden="true" />
              Private reset
            </span>
          </div>
          <a href="#find-access">
            Explore your community <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
        <ResidentDemo />
      </section>

      <section
        className="partner-model"
        id="providers"
        aria-labelledby="provider-heading"
      >
        <div
          className="partner-photo"
          role="img"
          aria-label="A rural road connecting distant communities"
        >
          <div>
            <span>BYOP</span>
            <strong>Providers keep their platform.</strong>
          </div>
        </div>
        <div className="partner-copy">
          <p className="section-label">Provider-led pathways</p>
          <h2 id="provider-heading">
            Providers keep their platform.
            <br />
            Communities arrive better prepared.
          </h2>
          <p>
            The Bring Your Own Platform model preserves the line between
            readiness and clinical care. Licensed providers retain
            responsibility for records, compliance, medical judgment, telehealth
            tools, and patient care; SozoRock Health strengthens the
            non-clinical preparation layer around those services.
          </p>
          <ul className="readiness-list">
            {providerSteps.map(({ icon: Icon, title, copy }) => (
              <li key={title}>
                <Icon size={25} aria-hidden="true" />
                <span>
                  <strong>{title}</strong>
                  <small>{copy}</small>
                </span>
              </li>
            ))}
          </ul>
          <a className="primary-action dark" href="#partner">
            Begin provider readiness <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section
        className="county-story"
        id="counties"
        aria-labelledby="county-heading"
      >
        <div className="county-heading">
          <div>
            <p className="section-label light">
              County-Based Community Access Platform
            </p>
            <h2 id="county-heading">
              From fragmented signals to systems intelligence.
            </h2>
          </div>
          <p>
            CB-CAP provides privacy-preserving, de-identified pathway
            intelligence for access-gap visibility, Health Equity Hub and Health
            Access Day planning, Community Health Assessment and Community
            Health Improvement Plan support, and county systems learning.
          </p>
        </div>
        <div className="county-preview">
          <div className="county-preview-top">
            <strong>CB-CAP</strong>
            <span>Sample view · No personal records</span>
            <a href={cbcapUrl}>
              Explore CB-CAP <ArrowSquareOut size={14} aria-hidden="true" />
            </a>
          </div>
          <div className="capability-row">
            <div>
              <span>Filter</span>
              <strong>Every U.S. geography</strong>
              <small>State, county, ZIP, hub type, language, and period</small>
            </div>
            <div>
              <span>Compare</span>
              <strong>Patterns over time</strong>
              <small>See access pathways and community barriers</small>
            </div>
            <div>
              <span>Protect</span>
              <strong>Privacy thresholds</strong>
              <small>Small groups are suppressed before reporting</small>
            </div>
            <div>
              <span>Download</span>
              <strong>Decision-ready reports</strong>
              <small>Accessible CSV and PDF exports for approved users</small>
            </div>
          </div>
          <div className="chart-row">
            <div className="chart-copy">
              <ChartLineUp size={38} aria-hidden="true" />
              <h3>Visualize, compare, and act</h3>
              <p>
                The public preview explains the capability. County access is
                approved through an interest and readiness process.
              </p>
              <a href={cbcapUrl}>
                View the sample dashboard{" "}
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
            <figure className="mini-chart">
              <figcaption>
                Sample access pattern — not live county data
              </figcaption>
              <div aria-hidden="true">
                <i style={{ height: "32%" }} />
                <i style={{ height: "47%" }} />
                <i style={{ height: "44%" }} />
                <i style={{ height: "65%" }} />
                <i style={{ height: "58%" }} />
                <i style={{ height: "79%" }} />
                <i style={{ height: "73%" }} />
                <i style={{ height: "92%" }} />
              </div>
              <p className="sr-only">
                A sample bar chart demonstrates how access activity can be
                compared over time. It does not contain live county data.
              </p>
            </figure>
          </div>
        </div>
      </section>

      <section
        className="ai-layer"
        id="technology"
        aria-labelledby="technology-heading"
      >
        <div>
          <p className="section-label">AI-enabled infrastructure</p>
          <h2 id="technology-heading">
            Intelligence where it strengthens a system. Human judgment where
            responsibility lives.
          </h2>
        </div>
        <div className="ai-principles">
          <article>
            <MicrophoneStage size={32} aria-hidden="true" />
            <h3>Live voice</h3>
            <p>
              Voice Access supports resident readiness, local discovery, and
              provider-led pathway preparation, with a text option at every
              step.
            </p>
          </article>
          <article>
            <Translate size={32} aria-hidden="true" />
            <h3>Translation</h3>
            <p>
              English and Spanish are supported from launch, with additional
              languages added responsibly.
            </p>
          </article>
          <article>
            <UsersThree size={32} aria-hidden="true" />
            <h3>Guided AI support</h3>
            <p>
              Purpose-built assistance helps residents and institutions prepare
              for and use existing systems. It never diagnoses, prescribes, or
              replaces a provider.
            </p>
          </article>
          <article>
            <Scales size={32} aria-hidden="true" />
            <h3>Human oversight</h3>
            <p>
              Residents choose how to proceed, providers remain responsible for
              care, and authorized people remain accountable.
            </p>
          </article>
        </div>
      </section>

      <section
        className="assurance"
        id="assurance"
        aria-labelledby="assurance-heading"
      >
        <div>
          <p className="section-label light">
            Upcoming public-interest publication series
          </p>
          <h2 id="assurance-heading">Health Systems Assurance</h2>
          <p className="assurance-deck">
            Digital Assurance, Governance, and AI-Enabled Health Infrastructure
          </p>
        </div>
        <div className="assurance-copy">
          <p>
            The series addresses a central implementation problem: digital tools
            are expanding rapidly, while public agencies, providers, residents,
            and community institutions need stronger assurance that these
            systems operate safely, transparently, and within defined governance
            boundaries.
          </p>
          <div className="assurance-layers">
            <span>Health data infrastructure</span>
            <span>AI intelligence</span>
            <span>Workflow orchestration</span>
            <span>Governance control planes</span>
            <span>Digital assurance</span>
            <span>Human review & public trust</span>
          </div>
          <strong>By Oluwabiyi Adeyemo</strong>
        </div>
      </section>

      <section
        className="publications"
        id="publications"
        aria-labelledby="publication-heading"
      >
        <div className="publication-heading">
          <p className="section-label">The ideas beneath the infrastructure</p>
          <h2 id="publication-heading">Built from a body of work.</h2>
          <p>
            Oluwabiyi Adeyemo&rsquo;s publications move rural equity from
            isolated programs toward durable, accountable health and public
            systems.
          </p>
        </div>
        <div className="publication-grid">
          <article>
            <a
              className="cover"
              href="/publications/rural-equity-blueprint-volume-1.pdf"
              aria-label="Open Rural Equity Blueprint Series, Volume 1: Access Day"
            >
              <img
                src="/publications/covers/rural-equity-blueprint-volume-1.png"
                alt="Cover of Rural Equity Blueprint Series, Volume 1: Access Day"
                loading="lazy"
              />
            </a>
            <div>
              <span>Rural Equity Blueprint Series</span>
              <h3>Volume 1: Access Day</h3>
              <p>
                The hub model, chronic-illness awareness, readiness, workforce
                renewal, health literacy, and practical field activation.
              </p>
              <a
                href="/publications/rural-equity-blueprint-volume-1.pdf"
                download
              >
                Download the publication{" "}
                <DownloadSimple size={15} aria-hidden="true" />
              </a>
            </div>
          </article>
          <article>
            <a
              className="cover"
              href="/publications/rethinking-rural-governance-volume-1.pdf"
              aria-label="Open Rethinking Rural Governance, Volume 1"
            >
              <img
                src="/publications/covers/rethinking-rural-governance-volume-1.png"
                alt="Cover of Rethinking Rural Governance, Volume 1"
                loading="lazy"
              />
            </a>
            <div>
              <span>Rethinking Rural Governance</span>
              <h3>From Compliance to Systems Intelligence</h3>
              <p>
                The governance foundation for CB-CAP: proactive, transparent,
                and designed to help communities act.
              </p>
              <a
                href="/publications/rethinking-rural-governance-volume-1.pdf"
                download
              >
                Download the publication{" "}
                <DownloadSimple size={15} aria-hidden="true" />
              </a>
            </div>
          </article>
        </div>
        <aside className="upcoming-series">
          <span>Upcoming publication line</span>
          <div>
            <h3>Health Systems Assurance</h3>
            <p>
              Digital assurance, governance control planes, AI-enabled health
              infrastructure, workflow orchestration, cybersecurity readiness,
              and safe non-clinical implementation.
            </p>
          </div>
          <strong>By Oluwabiyi Adeyemo</strong>
        </aside>
      </section>

      <section className="about" id="about" aria-labelledby="about-heading">
        <p className="section-label light">About SozoRock Health</p>
        <div>
          <h2 id="about-heading">
            A national endeavor.
            <br />
            Built for accountable implementation.
          </h2>
          <p>
            Architected, coordinated, and led by Oluwabiyi Adeyemo, SozoRock
            Health brings together rural and underserved health access,
            chronic-disease mitigation, digital navigation, AI readiness,
            public-sector modernization, cybersecurity readiness, and
            interdisciplinary workforce development. The work begins in New York
            and is designed for every U.S. state and county.
          </p>
        </div>
      </section>

      <section
        className="partner-section"
        id="partner"
        aria-labelledby="partner-heading"
      >
        <div>
          <p className="section-label">Get involved</p>
          <h2 id="partner-heading">What system are you ready to strengthen?</h2>
          <p>
            Tell us about your community, provider network, library,
            institution, public agency, or county. We will respond with the
            right readiness and implementation pathway.
          </p>
          <a href="mailto:contact@sozorockfoundation.org">
            <EnvelopeSimple size={16} aria-hidden="true" />
            contact@sozorockfoundation.org
          </a>
        </div>
        <ContactForm />
      </section>

      <footer className="site-footer">
        <div className="footer-main">
          <div>
            <a
              className="brand-lockup footer-brand"
              href="#top"
              aria-label="SozoRock Health home"
            >
              <span className="wordmark-image">
                <img
                  src="/brand/sozorock-wordmark-transparent.png"
                  alt="SozoRock"
                />
                <sup aria-label="registered trademark">®</sup>
              </span>
              <span>HEALTH</span>
            </a>
            <p>
              Non-clinical health, workforce-readiness, and systems
              infrastructure.
            </p>
          </div>
          <div className="footer-links">
            <div>
              <h2>SozoRock Health</h2>
              <a href="#how-it-works">Health Equity Hubs</a>
              <a href="#resident">Voice Access</a>
              <a href="#providers">Provider-led pathways</a>
              <a href="#counties">County systems intelligence</a>
            </div>
            <div>
              <h2>Legal & access</h2>
              <a href="/privacy">Privacy notice</a>
              <a href="/terms">Terms of use</a>
              <a href="/accessibility">Accessibility</a>
              <a href="#partner">Contact</a>
            </div>
            <div>
              <h2>Connect</h2>
              <a
                href="https://x.com/srockfoundation"
                target="_blank"
                rel="noreferrer"
              >
                <XLogo size={17} aria-hidden="true" />X @srockfoundation
              </a>
              <a
                href="https://www.youtube.com/@srockfoundation"
                target="_blank"
                rel="noreferrer"
              >
                <YoutubeLogo size={17} aria-hidden="true" />
                YouTube srockfoundation
              </a>
              <a
                href="https://www.instagram.com/srockfoundation/"
                target="_blank"
                rel="noreferrer"
              >
                <InstagramLogo size={17} aria-hidden="true" />
                Instagram @srockfoundation
              </a>
              <a
                href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fhealth.sozorockfoundation.org"
                target="_blank"
                rel="noreferrer"
              >
                <LinkedinLogo size={17} aria-hidden="true" />
                Share on LinkedIn
              </a>
              <a
                href="https://www.sozorockfoundation.org"
                target="_blank"
                rel="noreferrer"
              >
                <GlobeHemisphereWest size={17} aria-hidden="true" />
                www.sozorockfoundation.org
              </a>
            </div>
          </div>
        </div>
        <div className="footer-legal">
          <p>
            SozoRock® is a registered trademark of SozoRock Tech Inc., used
            under license by The SozoRock Foundation.
          </p>
          <p>
            The SozoRock Foundation, Inc. is a nonprofit, tax-exempt charitable
            organization under Section 501(c)(3) of the Internal Revenue Code.
          </p>
          <small>
            © {new Date().getFullYear()} The SozoRock Foundation, Inc. All
            rights reserved.
          </small>
        </div>
      </footer>
    </main>
  );
}
