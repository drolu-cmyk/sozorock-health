import type { Metadata } from "next";
import { ArrowLeft, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import { ApprovedBrandLockup } from "../components/ApprovedBrandLockup";
import { ContactForm } from "../components/ContactForm";

export const metadata: Metadata = {
  title: "Get involved",
  description:
    "Partner with SozoRock Health, support CB-CAP, explore a BYOP provider pathway, volunteer, fund the work, or contact the media team.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Get involved with SozoRock Health",
    description:
      "Start a partnership, provider, county, volunteer, funding, publication, or media conversation.",
    url: "/contact",
  },
};

type ContactPageProps = {
  searchParams: Promise<{
    interest?: string | string[];
    location?: string | string[];
  }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;
  const initialInterest = Array.isArray(params.interest)
    ? params.interest[0]
    : params.interest ?? "";
  const initialLocation = (
    Array.isArray(params.location) ? params.location[0] : params.location ?? ""
  )
    .trim()
    .slice(0, 120);

  return (
    <div className="approved-contact">
      <a className="skip-link" href="#contact-main">
        Skip to contact form
      </a>
      <header className="approved-contact__header">
        <a href="/" className="approved-contact__brand" aria-label="SozoRock Health home">
          <ApprovedBrandLockup />
          <span>Care. For every ZIP Code.</span>
        </a>
        <a href="/" className="approved-contact__back">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to SozoRock Health
        </a>
      </header>

      <main id="contact-main">
        <section className="approved-contact__section" aria-labelledby="contact-title">
          <div className="approved-contact__intro">
            <p className="section-label">Get involved</p>
            <h1 id="contact-title">Start with the outcome.</h1>
            <p>
              Tell us what you want to make possible. We will route your inquiry to the
              right SozoRock Health conversation.
            </p>
          </div>

          <div className="inquiry-layout">
            <div>
              <h2>Choose the right starting point.</h2>
              <p>
                Use this form for Health Equity Hubs, Health Access Day, BYOP, CB-CAP,
                funding, volunteering, research, publications, public-sector work, or media.
              </p>
              <a href="mailto:contact@sozorockfoundation.org">
                <EnvelopeSimple size={19} aria-hidden="true" />
                contact@sozorockfoundation.org
              </a>
            </div>
            <ContactForm
              initialInterest={initialInterest}
              initialLocation={initialLocation}
            />
          </div>
        </section>
      </main>

      <footer className="approved-contact__footer">
        <p>© 2026 The SozoRock Foundation, Inc.</p>
        <nav aria-label="Public trust">
          <a href="/privacy">Privacy</a>
          <a href="/accessibility">Accessibility</a>
          <a href="/nondiscrimination">Nondiscrimination</a>
          <a href="/terms">Terms of Use</a>
        </nav>
      </footer>
    </div>
  );
}
