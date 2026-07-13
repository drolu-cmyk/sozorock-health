import {
  ArrowRight,
  Books,
  CheckCircle,
  EnvelopeSimple,
  HandHeart,
  Heartbeat,
  HouseLine,
  MapPin,
  Path,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Image from "next/image";
import { ContactForm } from "./components/ContactForm";
import { HeroPathVisual } from "./components/HeroPathVisual";
import { NationalLocationFinder } from "./components/NationalLocationFinder";
import { ResidentDemo } from "./components/ResidentDemo";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: { "en-US": "/", "es-US": "/es" },
  },
};

const priorities = [
  ["Cardiovascular health", "Emerging priority"],
  ["Diabetes and metabolic health", "Current work"],
  ["Cancer awareness and screening access", "Open for partnership"],
  ["Maternal and family health", "Open for partnership"],
  ["Mental and behavioral health", "Emerging priority"],
  ["Kidney health", "Open for partnership"],
  ["Respiratory health", "Open for partnership"],
  ["Healthy aging", "Emerging priority"],
  ["Prevention and early detection", "Current work"],
  ["Health literacy", "Current work"],
  ["Digital health access", "Current work"],
  ["Rural healthcare access", "Current work"],
];

const involvement = [
  [
    "Partner with us",
    "Build a practical pathway around a community or institutional need.",
  ],
  [
    "Fund the work",
    "Support implementation, research, public education, or responsible technology.",
  ],
  [
    "Volunteer",
    "Contribute time and experience within a clearly defined non-clinical role.",
  ],
  [
    "Support publications",
    "Help extend public-interest research and practical implementation guidance.",
  ],
  [
    "Bring the model to a community",
    "Begin a readiness conversation for a Health Equity Hub or Health Access Day.",
  ],
  [
    "Public-sector inquiry",
    "Explore county, state, university, or agency collaboration.",
  ],
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />

      <main id="main-content" tabIndex={-1}>
        <section className="new-hero" aria-labelledby="hero-heading">
          <div className="new-hero__copy">
            <p className="eyebrow">Nonprofit health access initiative</p>
            <h1 id="hero-heading">
              A clearer path to care that already exists.
            </h1>
            <p className="hero-summary">
              SozoRock Health helps people turn uncertainty into practical next
              steps while licensed care stays with licensed providers.
            </p>
            <a className="button button--clay" href="#model">
              Explore the model <ArrowRight size={17} aria-hidden="true" />
            </a>
            <p className="boundary">
              Not a clinic. Not a provider. Not a telehealth platform.
            </p>
          </div>
          <HeroPathVisual
            label="An illustrated route moves from uncertainty through community landmarks toward a clear destination"
            caption="From uncertainty to a practical next step."
          />
        </section>

        <NationalLocationFinder />

        <section className="problem-band" aria-labelledby="problem-heading">
          <div className="section-heading section-heading--compact">
            <p className="eyebrow">The problem</p>
            <h2 id="problem-heading">
              Care may exist. The path to it may not be clear.
            </h2>
          </div>
          <div className="problem-points">
            <article>
              <Path size={30} aria-hidden="true" />
              <h3>Knowing where to begin</h3>
            </article>
            <article>
              <MapPin size={30} aria-hidden="true" />
              <h3>Finding the right local resource</h3>
            </article>
            <article>
              <Heartbeat size={30} aria-hidden="true" />
              <h3>Reaching appropriate care</h3>
            </article>
          </div>
        </section>

        <section
          className="model-section"
          id="model"
          aria-labelledby="model-heading"
        >
          <div className="section-heading">
            <p className="eyebrow">The missing layer</p>
            <h2 id="model-heading">
              Practical guidance between uncertainty and appropriate care.
            </h2>
            <p>
              SozoRock Health helps people and institutions use existing
              healthcare, public-health, digital, and community systems more
              effectively.
            </p>
          </div>
          <ol
            className="pathway"
            aria-label="How the SozoRock Health model works"
          >
            <li>
              <span>Start</span>
              <div>
                <h3>Understand the need</h3>
                <p>
                  Clarify the immediate question and the practical barriers
                  around it.
                </p>
              </div>
            </li>
            <li>
              <span>Navigate</span>
              <div>
                <h3>Identify appropriate options</h3>
                <p>
                  Find useful services, resources, preparation, or community
                  support.
                </p>
              </div>
            </li>
            <li>
              <span>Connect</span>
              <div>
                <h3>Reach the right destination</h3>
                <p>
                  Connect with a community resource or licensed provider when
                  needed.
                </p>
              </div>
            </li>
          </ol>
          <div className="model-boundary">
            <ShieldCheck size={28} aria-hidden="true" />
            <p>
              <strong>
                Licensed care remains with licensed professionals.
              </strong>{" "}
              SozoRock Health does not diagnose, treat, prescribe, or make
              clinical decisions.
            </p>
          </div>
        </section>

        <section
          className="systems-section"
          id="systems"
          aria-labelledby="systems-heading"
        >
          <div className="section-heading section-heading--split">
            <div>
              <p className="eyebrow eyebrow--light">Systems model</p>
              <h2 id="systems-heading">One model. Four connected layers.</h2>
            </div>
            <p>
              The layers keep resident support, licensed care, public planning,
              and institutional readiness distinct while helping them work
              together.
            </p>
          </div>
          <div className="systems-grid">
            <article>
              <span>Resident layer</span>
              <h3>Non-clinical access enablement</h3>
              <p>
                Health Equity Hubs, Health Access Day, Voice Access, and digital
                readiness help people prepare for existing services.
              </p>
            </article>
            <article>
              <span>Provider layer</span>
              <h3>Provider-led pathways</h3>
              <p>
                In the Bring Your Own Platform model, licensed providers retain
                their clinical systems, judgment, records, and care.
              </p>
            </article>
            <article>
              <span>County layer</span>
              <h3>County-Based Community Access Platform (CB-CAP)</h3>
              <p>
                De-identified pathway intelligence supports access-gap
                visibility, hub planning, and Community Health Assessment and
                Community Health Improvement Plan work.
              </p>
            </article>
            <article>
              <span>Readiness layer</span>
              <h3>Institutions prepared to act</h3>
              <p>
                AI readiness, cybersecurity readiness, public-sector
                modernization, and interdisciplinary workforce development
                strengthen accountable implementation.
              </p>
            </article>
          </div>
          <p className="systems-note">
            CB-CAP supports system-level learning without exposing individual
            protected health information or turning non-clinical activity into
            patient management.
          </p>
        </section>

        <section
          className="resident-experience"
          aria-labelledby="resident-heading"
        >
          <div className="resident-experience__copy">
            <p className="eyebrow eyebrow--light">Resident access layer</p>
            <h2 id="resident-heading">
              Speak, tap, or type. Begin with what feels clear.
            </h2>
            <p>
              Voice Access can help a resident prepare for provider-led
              services, locate a Health Equity Hub, understand Health Access Day
              readiness, or find non-clinical support.
            </p>
            <ul>
              <li>
                <CheckCircle size={19} aria-hidden="true" />
                No diagnosis or treatment advice
              </li>
              <li>
                <CheckCircle size={19} aria-hidden="true" />
                Text and tap remain available
              </li>
              <li>
                <CheckCircle size={19} aria-hidden="true" />
                Microphone starts only with consent
              </li>
            </ul>
          </div>
          <ResidentDemo />
        </section>

        <section className="hub-section" aria-labelledby="hub-heading">
          <div className="section-heading">
            <p className="eyebrow">Health Equity Hubs</p>
            <h2 id="hub-heading">Support shaped around local life.</h2>
            <p>
              Each format helps residents prepare for and use existing services
              without creating a clinical relationship.
            </p>
          </div>
          <div className="hub-path">
            <article>
              <Books size={38} aria-hidden="true" />
              <h3>Library</h3>
              <p>
                Digital literacy, telehealth preparation, education, and
                benefits support in a familiar public setting.
              </p>
            </article>
            <article>
              <UsersThree size={38} aria-hidden="true" />
              <h3>Community</h3>
              <p>
                Readiness and public education in trusted community spaces,
                where locally supported.
              </p>
            </article>
            <article>
              <HouseLine size={38} aria-hidden="true" />
              <h3>Home</h3>
              <p>
                Configured technology and remote support concepts for people
                facing mobility, transport, or digital barriers.
              </p>
            </article>
          </div>
        </section>

        <section
          className="priorities-section"
          id="priorities"
          aria-labelledby="priorities-heading"
        >
          <div className="section-heading section-heading--split">
            <div>
              <p className="eyebrow eyebrow--light">Health priorities</p>
              <h2 id="priorities-heading">
                A framework built for different community needs.
              </h2>
            </div>
            <p>
              Labels distinguish work already underway from areas being
              developed or opened for partnership. They do not claim programs
              that do not yet exist.
            </p>
          </div>
          <div className="priority-legend" aria-label="Priority status legend">
            <span>Current work</span>
            <span>Emerging priority</span>
            <span>Open for partnership</span>
          </div>
          <div className="priority-grid">
            {priorities.map(([name, status]) => (
              <article key={name}>
                <span
                  className={`status status--${status.toLowerCase().replaceAll(" ", "-")}`}
                >
                  {status}
                </span>
                <h3>{name}</h3>
              </article>
            ))}
          </div>
        </section>

        <section
          className="national-section"
          aria-labelledby="national-heading"
        >
          <div className="section-heading">
            <p className="eyebrow">National by design</p>
            <h2 id="national-heading">
              Local readiness determines what happens next.
            </h2>
            <p>
              SozoRock Health is based in New York and welcomes partnership
              inquiries from every U.S. state and county. Local activity is
              never implied until it is confirmed.
            </p>
          </div>
          <div className="national-map">
            <Image
              src="/media/us-county-map.webp"
              width={1470}
              height={915}
              alt="Map of United States counties, presented as a national planning landscape without implying active work in every county"
              sizes="(max-width: 820px) 100vw, 65vw"
            />
            <div className="map-status-list">
              <p>
                <span className="dot dot--home" />
                Foundation home <strong>New York</strong>
              </p>
              <p>
                <span className="dot dot--interest" />
                Partnership interest <strong>Open nationwide</strong>
              </p>
              <p>
                <span className="dot dot--future" />
                Local activation{" "}
                <strong>Confirmed only after readiness review</strong>
              </p>
            </div>
          </div>
        </section>

        <section
          className="publications-section"
          id="publications"
          aria-labelledby="publications-heading"
        >
          <div className="section-heading">
            <p className="eyebrow">Publications</p>
            <h2 id="publications-heading">Ideas that shape the work.</h2>
            <p>
              Oluwabiyi Adeyemo’s publications examine how health access, public
              systems, technology, and accountability can work together.
            </p>
          </div>
          <div className="publication-shelf">
            <article>
              <Image
                src="/publications/covers/rural-equity-blueprint-volume-1.png"
                width={1320}
                height={1688}
                alt="Rural Equity Blueprint Series, Volume 1: Access Day cover"
                sizes="(max-width: 600px) 130px, 280px"
              />
              <div>
                <span>Available</span>
                <h3>Rural Equity Blueprint Series, Volume 1</h3>
                <p>
                  A practical framework for health literacy, readiness, access
                  equity, and community activation.
                </p>
                <a href="/publications/rural-equity-blueprint-volume-1">
                  Access publication <ArrowRight size={15} aria-hidden="true" />
                </a>
              </div>
            </article>
            <article>
              <Image
                src="/publications/covers/rethinking-rural-governance-volume-1.png"
                width={1275}
                height={1650}
                alt="Rethinking Rural Governance, Volume 1 cover"
                sizes="(max-width: 600px) 130px, 280px"
              />
              <div>
                <span>Available</span>
                <h3>Rethinking Rural Governance, Volume 1</h3>
                <p>
                  A governance foundation for proactive, accountable, and
                  better-informed public systems.
                </p>
                <a href="/publications/rethinking-rural-governance-volume-1">
                  Access publication <ArrowRight size={15} aria-hidden="true" />
                </a>
              </div>
            </article>
          </div>
        </section>

        <section
          className="assurance-section"
          aria-labelledby="assurance-heading"
        >
          <div>
            <p className="eyebrow eyebrow--light">In development</p>
            <h2 id="assurance-heading">Health Systems Assurance</h2>
            <p>
              Digital Assurance, Governance, and AI-Enabled Health
              Infrastructure
            </p>
          </div>
          <div
            className="assurance-sequence"
            aria-label="Health Systems Assurance sequence"
          >
            <span>Education</span>
            <ArrowRight aria-hidden="true" />
            <span>Implementation</span>
            <ArrowRight aria-hidden="true" />
            <span>Verification</span>
            <ArrowRight aria-hidden="true" />
            <span>Trust</span>
          </div>
          <p>
            For public agencies, providers, researchers, community institutions,
            and implementers responsible for safe, transparent digital systems.
          </p>
          <a href="/publications/health-systems-assurance">
            View the series{" "}
            <ArrowRight size={15} aria-hidden="true" />
          </a>
        </section>

        <section
          className="leadership-section"
          id="about"
          aria-labelledby="leadership-heading"
        >
          <div className="leadership-editorial">
            <span>Strategy</span>
            <span>Research</span>
            <span>Implementation</span>
            <span>Public systems</span>
          </div>
          <div>
            <p className="eyebrow">Leadership</p>
            <h2 id="leadership-heading">
              Designed and led by Oluwabiyi Adeyemo.
            </h2>
            <p>
              Oluwabiyi leads the strategy behind SozoRock Health, bringing
              together health access, research, technology, workforce
              development, and public-system readiness.
            </p>
            <p className="leadership-role">
              <strong>Director of Strategic Initiatives</strong>
              <br />
              The SozoRock Foundation, Inc.
            </p>
            <div className="leadership-links">
              <a
                href="https://sozorockfoundation.org/about-us"
                target="_blank"
                rel="noreferrer"
              >
                View full profile <ArrowRight size={15} aria-hidden="true" />
              </a>
              <span>Selected publications</span>
              <a href="/publications/rural-equity-blueprint-volume-1">
                Rural Equity Blueprint, Volume 1
              </a>
              <a href="/publications/rethinking-rural-governance-volume-1">
                Rethinking Rural Governance, Volume 1
              </a>
            </div>
          </div>
        </section>

        <section
          className="foundation-statement"
          aria-label="About The SozoRock Foundation"
        >
          <p>
            The SozoRock Foundation develops practical ways to improve health
            access, strengthen public systems, and prepare communities for
            lasting change.
          </p>
          <span>
            SozoRock Health is an initiative of The SozoRock Foundation, Inc., a
            New York–based 501(c)(3) nonprofit.
          </span>
        </section>

        <section
          className="involved-section"
          id="get-involved"
          aria-labelledby="involved-heading"
        >
          <div className="section-heading">
            <p className="eyebrow">Get involved</p>
            <h2 id="involved-heading">Choose how you want to help.</h2>
            <p>
              Start with your goal. The form will ask only for information
              relevant to that pathway.
            </p>
          </div>
          <div className="involvement-grid">
            {involvement.map(([title, copy]) => (
              <a key={title} href="#inquiry-form">
                <HandHeart size={27} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{copy}</p>
                <span>
                  Begin <ArrowRight size={14} aria-hidden="true" />
                </span>
              </a>
            ))}
          </div>
          <div id="inquiry-form" className="inquiry-layout">
            <div>
              <h3>Tell us what you are working toward.</h3>
              <p>
                Do not include medical, emergency, or protected health
                information.
              </p>
              <a href="mailto:contact@sozorockfoundation.org">
                <EnvelopeSimple size={17} aria-hidden="true" />
                contact@sozorockfoundation.org
              </a>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
