"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  Buildings,
  Bus,
  CalendarCheck,
  ChartLineUp,
  Check,
  GraduationCap,
  Handshake,
  House,
  Keyboard,
  Books as Library,
  LinkSimple,
  MapPin,
  List as Menu,
  Microphone,
  Monitor,
  ShieldCheck,
  SpeakerHigh,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { ApprovedLocationSearch } from "./ApprovedLocationSearch";
import { ApprovedPublications } from "./ApprovedPublications";

const voicePrompts = [
  {
    label: "Find a trusted starting point",
    resident: "I know I need help, but I am not sure where to begin.",
    response:
      "We can start with what is making the next step difficult—travel, technology, language or finding the right local resource.",
  },
  {
    label: "Prepare for a provider visit",
    resident: "Can you help me get ready for a virtual visit?",
    response:
      "Yes. We can check your connection, help you open the provider’s platform and make sure you know what information to have ready.",
  },
  {
    label: "Find support near me",
    resident: "Is there somewhere nearby where I can use a tablet?",
    response:
      "Search by ZIP Code, city or county to see participating library, community and home-based options as they become available.",
  },
];

const audienceDetails = {
  Residents: {
    title: "A next step you can understand.",
    text: "Begin by voice or touch, prepare for provider-led services and use support in a familiar place.",
    action: "Explore resident access",
  },
  Providers: {
    title: "Keep the platform and clinical workflow you trust.",
    text: "SozoRock prepares people to use existing provider services without taking over records, clinical judgment or follow-up.",
    action: "Explore BYOP",
  },
  Counties: {
    title: "See where pathways break before planning the response.",
    text: "Use de-identified, place-based intelligence to support Health Equity Hub planning, CHA and CHIP work.",
    action: "Explore CB-CAP",
  },
  Partners: {
    title: "Back infrastructure that strengthens what already exists.",
    text: "Support local implementation, research, workforce pathways and accountable public-interest technology.",
    action: "Partner with us",
  },
};

function BrandLockup({ inverse = false }) {
  return (
    <span className={`brand-lockup${inverse ? " brand-lockup--inverse" : ""}`} aria-label="SozoRock Health">
      <span className="brand-word">
        SozoRock<sup aria-label="registered trademark">®</sup>
      </span>
      <span className="brand-health">Health</span>
    </span>
  );
}

function SectionLabel({ children, light = false }) {
  return <p className={`section-label${light ? " section-label--light" : ""}`}>{children}</p>;
}

function ArrowLink({ href, children, className = "" }) {
  return (
    <a className={`arrow-link ${className}`} href={href}>
      <span>{children}</span>
      <ArrowRight size={20} aria-hidden="true" />
    </a>
  );
}

export function ApprovedMarketingHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [audience, setAudience] = useState("Residents");
  const menuId = useId();

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.dataset.menuOpen = menuOpen ? "true" : "false";
    return () => {
      window.removeEventListener("keydown", onKey);
      delete document.documentElement.dataset.menuOpen;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const selectedVoice = voicePrompts[voiceIndex];
  const selectedAudience = audienceDetails[audience];

  return (
    <div className="approved-home">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <header className="site-header" aria-label="Main navigation">
        <a className="brand-link" href="#top" aria-label="SozoRock Health home">
          <BrandLockup inverse />
          <span className="brand-tagline">Care. For every ZIP Code.</span>
        </a>

        <nav className="desktop-nav" aria-label="Primary">
          <a href="#what-we-do">What We Do</a>
          <a href="#hubs">Health Equity Hubs</a>
          <a href="#access-day">Health Access Day</a>
          <a href="#publications">Publications</a>
          <a href="#about">About</a>
          <a className="header-cta" href="#get-involved">Get Involved</a>
        </nav>

        <button
          className="menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>

        <nav id={menuId} className={`mobile-nav${menuOpen ? " is-open" : ""}`} aria-label="Mobile">
          <a href="#what-we-do" onClick={closeMenu}>What We Do</a>
          <a href="#hubs" onClick={closeMenu}>Health Equity Hubs</a>
          <a href="#access-day" onClick={closeMenu}>Health Access Day</a>
          <a href="#publications" onClick={closeMenu}>Publications</a>
          <a href="#about" onClick={closeMenu}>About</a>
          <a href="#get-involved" onClick={closeMenu}>Get Involved</a>
        </nav>
      </header>

      <main id="main-content">
        <section id="top" className="hero" aria-labelledby="hero-title">
          <Image
            className="hero-image"
            src="/media/approved-home/hero-tablet.webp"
            alt="Two people working together with a tablet in a community setting."
            fill
            priority
            sizes="100vw"
          />
          <div className="hero-scrim" aria-hidden="true" />
          <div className="hero-content">
            <p className="hero-eyebrow">Nonprofit health-equity systems infrastructure</p>
            <h1 id="hero-title">A clearer path to <span>Care</span> that already exists.</h1>
            <p className="hero-copy">
              SozoRock Health helps people move from uncertainty to a practical next step—while licensed Care stays with licensed providers.
            </p>
            <div className="hero-actions">
              <a className="button button--signal" href="#what-we-do">See how it works</a>
              <a className="button button--outline" href="#place-search">Explore your area</a>
            </div>
            <p className="boundary">Not a clinic. Not a provider. Not a telehealth platform.</p>
          </div>
          <a className="hero-scroll" href="#problem" aria-label="Continue to the story">
            <span>See the barrier</span>
            <ArrowDown size={18} aria-hidden="true" />
          </a>
        </section>

        <section id="problem" className="problem section-pad" aria-labelledby="problem-title">
          <div className="measure-wide">
            <SectionLabel>The everyday problem</SectionLabel>
            <h2 id="problem-title" className="display-heading">Care can be nearby—and still hard to reach.</h2>

            <div className="barrier-sequence" aria-label="Examples of practical barriers">
              <article className="barrier-item">
                <div className="barrier-image barrier-image--road">
                  <Image src="/media/approved-home/rural-road.webp" alt="A long rural road leading toward a small community." width={565} height={426} sizes="(max-width: 640px) 100vw, 33vw" />
                </div>
                <div className="barrier-caption">
                  <Bus size={26} weight="regular" aria-hidden="true" />
                  <p>A ride falls through.</p>
                </div>
              </article>
              <span className="sequence-arrow" aria-hidden="true"><ArrowRight size={28} /></span>
              <article className="barrier-item">
                <div className="barrier-image barrier-image--tablet">
                  <Image src="/media/approved-home/hero-tablet.webp" alt="Hands using a tablet in a community setting." width={1800} height={1200} sizes="(max-width: 640px) 100vw, 33vw" />
                </div>
                <div className="barrier-caption">
                  <Monitor size={26} weight="regular" aria-hidden="true" />
                  <p>The portal will not open.</p>
                </div>
              </article>
              <span className="sequence-arrow" aria-hidden="true"><ArrowRight size={28} /></span>
              <article className="barrier-item">
                <div className="barrier-image barrier-image--distance">
                  <Image src="/media/approved-home/rural-road.webp" alt="A rural road illustrating the distance between people and services." width={565} height={426} sizes="(max-width: 640px) 100vw, 33vw" />
                  <span className="distance-label">Care may be several communities away.</span>
                </div>
                <div className="barrier-caption">
                  <MapPin size={26} weight="regular" aria-hidden="true" />
                  <p>The next appointment is two counties away.</p>
                </div>
              </article>
            </div>

            <div className="pathway-strip" aria-label="SozoRock pathway: Start, Prepare, Connect">
              <div><span>Start</span><p>Understand what is getting in the way.</p></div>
              <ArrowRight size={24} aria-hidden="true" />
              <div><span>Prepare</span><p>Make the practical next step possible.</p></div>
              <ArrowRight size={24} aria-hidden="true" />
              <div><span>Connect</span><p>Reach a trusted resource or licensed provider.</p></div>
            </div>
          </div>
        </section>

        <section id="what-we-do" className="missing-layer section-pad" aria-labelledby="layer-title">
          <div className="measure-wide editorial-split">
            <div>
              <SectionLabel light>The SozoRock layer</SectionLabel>
              <h2 id="layer-title">One practical layer between uncertainty and the right next step.</h2>
            </div>
            <div className="layer-copy">
              <p>
                SozoRock strengthens the health, public, digital and workforce systems a community already has. It helps people begin—and helps institutions see where the pathway keeps breaking.
              </p>
              <ArrowLink href="#hubs" className="arrow-link--light">See where the layer lives</ArrowLink>
            </div>
          </div>

          <div className="system-line measure-wide" aria-label="Relationship between existing services, SozoRock and licensed Care">
            <div className="system-node">
              <span>Existing services</span>
              <p>Providers, public health, community resources and benefits.</p>
            </div>
            <ArrowRight size={28} aria-hidden="true" />
            <div className="system-node system-node--active">
              <span>SozoRock practical layer</span>
              <p>Voice, hubs, readiness, targeted activation and place intelligence.</p>
            </div>
            <ArrowRight size={28} aria-hidden="true" />
            <div className="system-node">
              <span>Appropriate next step</span>
              <p>Community support or provider-led Care on the provider’s platform.</p>
            </div>
          </div>
        </section>

        <section id="hubs" className="hubs section-pad" aria-labelledby="hubs-title">
          <div className="measure-wide hubs-heading">
            <div>
              <SectionLabel>Health Equity Hub formats</SectionLabel>
              <h2 id="hubs-title" className="display-heading">Access where people already are.</h2>
            </div>
            <p>Open for partnership nationwide. Each format adapts to the place without turning the location into a clinic.</p>
          </div>

          <div className="hub-stage measure-wide">
            <Image src="/media/approved-home/library-hub.webp" alt="The interior of a community-built rural library." width={1400} height={1867} sizes="(max-width: 640px) 100vw, 45vw" />
            <div className="hub-list">
              <article>
                <Library size={38} weight="regular" aria-hidden="true" />
                <div><h3>Library Health Equity Hub</h3><p>A SozoRock tablet, digital readiness and a trusted public starting point.</p></div>
              </article>
              <article>
                <Buildings size={38} weight="regular" aria-hidden="true" />
                <div><h3>Community Health Equity Hub</h3><p>A neutral place for local education, support and provider-led pathways.</p></div>
              </article>
              <article>
                <House size={38} weight="regular" aria-hidden="true" />
                <div><h3>Home Health Equity Hub</h3><p>A configured tablet concept for mobility, travel or digital-access barriers.</p></div>
              </article>
            </div>
          </div>
        </section>

        <section id="voice" className="voice section-pad" aria-labelledby="voice-title">
          <div className="measure-wide voice-grid">
            <div className="voice-copy">
              <SectionLabel light>Voice Access</SectionLabel>
              <h2 id="voice-title">Ask in your own words.</h2>
              <p>
                Voice Access responds to practical barriers without creating a patient profile. It does not open medical records, diagnose, triage symptoms or provide clinical advice.
              </p>
              <div className="voice-modes" aria-label="Available interaction modes">
                <span><Microphone size={20} aria-hidden="true" /> Speak</span>
                <span><Keyboard size={20} aria-hidden="true" /> Type</span>
                <span><SpeakerHigh size={20} aria-hidden="true" /> Listen</span>
              </div>
            </div>

            <div className="voice-demo" aria-label="Interactive Voice Access design demonstration">
              <div className="voice-demo__header">
                <span><span className="live-dot" aria-hidden="true" /> Voice Access</span>
                <span>Non-clinical support</span>
              </div>
              <p className="voice-question">What would make the next step easier today?</p>
              <div className="voice-options" role="group" aria-label="Choose an example question">
                {voicePrompts.map((prompt, index) => (
                  <button
                    type="button"
                    key={prompt.label}
                    className={voiceIndex === index ? "is-selected" : ""}
                    aria-pressed={voiceIndex === index}
                    onClick={() => setVoiceIndex(index)}
                  >
                    {prompt.label}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div className="conversation" aria-live="polite">
                <p><span>You</span>{selectedVoice.resident}</p>
                <p><span>SozoRock</span>{selectedVoice.response}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="byop" className="byop section-pad" aria-labelledby="byop-title">
          <div className="measure-wide">
            <SectionLabel>Provider-led pathways</SectionLabel>
            <div className="byop-heading editorial-split">
              <h2 id="byop-title">Providers keep the platform they trust.</h2>
              <div>
                <p>SozoRock prepares the person. Licensed providers retain their records, consent, clinical workflow, medical judgment, treatment and follow-up.</p>
                <ArrowLink href="#get-involved">Explore BYOP partnership</ArrowLink>
              </div>
            </div>

            <div className="handoff" aria-label="Bring Your Own Platform handoff">
              <div className="handoff-side">
                <span className="handoff-label">Resident Access Layer</span>
                <div className="handoff-row"><Check size={20} aria-hidden="true" /><span>Understand the starting point</span></div>
                <div className="handoff-row"><Check size={20} aria-hidden="true" /><span>Prepare technology and information</span></div>
                <div className="handoff-row"><Check size={20} aria-hidden="true" /><span>Choose the provider-led pathway</span></div>
              </div>
              <div className="handoff-center">
                <LinkSimple size={36} aria-hidden="true" />
                <strong>BYOP</strong>
                <span>Prepared connection</span>
              </div>
              <div className="handoff-side handoff-side--provider">
                <span className="handoff-label">Licensed provider</span>
                <div className="handoff-row"><ShieldCheck size={20} aria-hidden="true" /><span>Own clinical platform</span></div>
                <div className="handoff-row"><ShieldCheck size={20} aria-hidden="true" /><span>Own records and consent</span></div>
                <div className="handoff-row"><ShieldCheck size={20} aria-hidden="true" /><span>Own clinical Care and follow-up</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="access-day" className="access-day section-pad" aria-labelledby="access-day-title">
          <div className="measure-wide access-day-grid">
            <div className="access-day-title">
              <SectionLabel light>Health Access Day · Open for partnership</SectionLabel>
              <h2 id="access-day-title">Bring the right response to the right place.</h2>
              <p>Local evidence shapes the location and focus. Licensed professionals deliver any clinical screening or education within their own credentials and scope.</p>
            </div>
            <div className="activation-flow" aria-label="How Health Access Day works">
              <article><ChartLineUp size={28} aria-hidden="true" /><span>See the local pattern</span><p>Identify barriers, chronic-disease priorities and readiness needs.</p></article>
              <article><CalendarCheck size={28} aria-hidden="true" /><span>Plan the response</span><p>Bring together the right institutions, educators and licensed professionals.</p></article>
              <article><UsersThree size={28} aria-hidden="true" /><span>Meet people locally</span><p>Support awareness, prevention, digital readiness and trusted connection.</p></article>
            </div>
          </div>
        </section>

        <section id="workforce" className="workforce section-pad" aria-labelledby="workforce-title">
          <div className="measure-wide workforce-layout">
            <div className="workforce-mark" aria-hidden="true"><GraduationCap size={92} weight="thin" /></div>
            <div>
              <SectionLabel>Workforce capacity</SectionLabel>
              <h2 id="workforce-title">Today’s shortage should shape tomorrow’s opportunity.</h2>
            </div>
            <div className="workforce-copy">
              <p>When the data shows current gaps or future pressure, SozoRock helps partners create practical pathways for emerging talent.</p>
              <p>Educators, employers, accredited institutions and licensing bodies keep their roles. The system helps them see where capacity is needed.</p>
            </div>
          </div>
        </section>

        <section id="cbcap" className="cbcap section-pad" aria-labelledby="cbcap-title">
          <div className="measure-wide cbcap-grid">
            <div>
              <SectionLabel light>County-Based Community Access Platform</SectionLabel>
              <h2 id="cbcap-title">See where the system loses people.</h2>
              <p>
                CB-CAP separates individual-facing support from county-level systems intelligence. It turns de-identified pathway patterns into useful planning questions for Health Equity Hubs, Health Access Day, CHA and CHIP work.
              </p>
              <ArrowLink href="#get-involved" className="arrow-link--light">See the CB-CAP story</ArrowLink>
            </div>
            <div className="cbcap-view" aria-label="Illustrative CB-CAP planning view">
              <div className="cbcap-view__top">
                <span>Place lens</span><span>Planning view</span><span>De-identified</span>
              </div>
              <div className="cbcap-questions">
                <article><span>Where</span><p>Which places face the greatest practical barriers?</p></article>
                <article><span>Why</span><p>Which mix of travel, technology, language or workforce pressure matters here?</p></article>
                <article><span>What next</span><p>Which hub, field activation or partnership response fits the place?</p></article>
              </div>
              <div className="cbcap-note">No individual medical record is required for this planning layer.</div>
            </div>
          </div>
        </section>

        <section id="about" className="value section-pad" aria-labelledby="value-title">
          <div className="measure-wide">
            <SectionLabel>Who the system serves</SectionLabel>
            <h2 id="value-title" className="display-heading">One system. Different value.</h2>
            <div className="audience-tabs" role="tablist" aria-label="Choose an audience">
              {Object.keys(audienceDetails).map((name) => (
                <button
                  type="button"
                  role="tab"
                  key={name}
                  aria-selected={audience === name}
                  className={audience === name ? "is-selected" : ""}
                  onClick={() => setAudience(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="audience-detail" role="tabpanel" aria-live="polite">
              <h3>{selectedAudience.title}</h3>
              <p>{selectedAudience.text}</p>
              <ArrowLink href="#get-involved">{selectedAudience.action}</ArrowLink>
            </div>
          </div>
        </section>

        <ApprovedPublications />
        <ApprovedLocationSearch />

        <section id="get-involved" className="closing section-pad" aria-labelledby="closing-title">
          <div className="measure-wide closing-inner">
            <SectionLabel>Start with the outcome</SectionLabel>
            <h2 id="closing-title">Make the path clearer in your community.</h2>
            <p>Bring a hub, Health Access Day, provider-led pathway, workforce partnership or place-intelligence conversation to your organization.</p>
            <div className="closing-actions">
              <a className="button button--ink" href="mailto:contact@sozorockfoundation.org">Start a partnership conversation</a>
              <a className="text-link" href="#publications">Read the ideas behind the work <ArrowRight size={18} aria-hidden="true" /></a>
            </div>
            <p className="closing-tagline">Care. For every ZIP Code.</p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="measure-wide footer-grid">
          <div className="footer-brand">
            <BrandLockup inverse />
            <p>A nonprofit health-equity systems initiative of The SozoRock Foundation, Inc.</p>
          </div>
          <div>
            <h2>Explore</h2>
            <a href="#what-we-do">What We Do</a>
            <a href="#hubs">Health Equity Hubs</a>
            <a href="#access-day">Health Access Day</a>
            <a href="#publications">Publications</a>
          </div>
          <div>
            <h2>Connect</h2>
            <a href="#get-involved">Partner with us</a>
            <a href="mailto:contact@sozorockfoundation.org">Contact</a>
            <a href="https://www.sozorockfoundation.org">The SozoRock Foundation</a>
          </div>
          <div>
            <h2>Public trust</h2>
            <a href="/privacy">Privacy</a>
            <a href="/accessibility">Accessibility</a>
            <a href="/nondiscrimination">Nondiscrimination</a>
            <a href="/terms">Terms of Use</a>
          </div>
        </div>
        <div className="measure-wide footer-legal">
          <p>© 2026 The SozoRock Foundation, Inc. SozoRock® is a registered trademark of SozoRock Tech Inc., used under license by The SozoRock Foundation, Inc.</p>
          <p>The SozoRock Foundation, Inc. is a nonprofit, tax-exempt charitable organization under Section 501(c)(3) of the Internal Revenue Code. EIN 39-4736725. Donations are tax-deductible as allowed by law.</p>
        </div>
      </footer>
    </div>
  );
}
