import { ContactForm } from "../components/ContactForm";
import { HealthShell } from "../components/HealthShell";
import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
export const metadata = healthMetadata(
  "Partner with Health",
  "Discuss community access, provider readiness, workforce capacity or research with SozoRock Health. Tell us the outcome your organization is working toward.",
  "/contact",
);
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{
    interest?: string | string[];
    location?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const initialInterest = (
    Array.isArray(params.interest)
      ? params.interest[0]
      : (params.interest ?? "")
  ).slice(0, 160);
  const initialLocation = (
    Array.isArray(params.location)
      ? params.location[0]
      : (params.location ?? "")
  )
    .trim()
    .slice(0, 120);
  return (
    <HealthShell>
      <main id="health-main" className="hs-content">
        <div className="hs-page-heading">
          <div>
            <p className="hs-eyebrow">Partner with Health</p>
            <h1>Bring an access challenge worth solving.</h1>
          </div>
          <p>
            Tell us about your place, your institution and the outcome you want
            to work toward.
          </p>
        </div>
        <div className="hs-contact-layout">
          <aside className="hs-contact-aside">
            <h2>Start with the need.</h2>
            <p>
              Community access. Digital and provider readiness. Workforce
              capacity. Research and evidence.
            </p>
            <p>
              Use this form for organizational inquiries and collaboration. It
              does not book appointments or connect you to clinical care.
            </p>
            <p>
              Do not include medical records, symptoms or urgent health
              information.
            </p>
            <a href="mailto:contact@sozorockfoundation.org">
              contact@sozorockfoundation.org
            </a>
          </aside>
          <ContactForm
            initialInterest={initialInterest}
            initialLocation={initialLocation}
          />
        </div>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            healthPageSchema("Contact", "/contact", "ContactPage"),
          ),
        }}
      />
    </HealthShell>
  );
}
