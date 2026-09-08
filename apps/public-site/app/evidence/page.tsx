import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { HealthShell } from "../components/HealthShell";
import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
export const metadata = healthMetadata(
  "Evidence for local decisions",
  "Find place-based evidence, inspect sources and explore research on health access, rural governance and health systems assurance.",
  "/evidence",
);
export default function EvidencePage() {
  return (
    <HealthShell>
      <main id="health-main" className="hs-content">
        <div className="hs-page-heading">
          <div>
            <p className="hs-eyebrow">Evidence</p>
            <h1>See the context. Examine the source.</h1>
          </div>
          <p>
            Useful evidence makes its geography, timing and limitations visible.
            Start with a place, a planning question or the research behind the
            work.
          </p>
        </div>
        <section className="hs-work-row">
          <h2>Place Intelligence</h2>
          <div>
            <p>
              Explore geographic evidence about the conditions around health
              access. Use the source, year and definition alongside each
              indicator when interpreting a place.
            </p>
            <p>
              Local indicators describe context. They do not establish
              individual needs, prove causation or confirm that a service is
              available.
            </p>
            <a className="hs-link" href="/explore">
              Open Place Intelligence
              <ArrowRight size={24} aria-hidden="true" />
            </a>
          </div>
        </section>
        <section className="hs-work-row">
          <h2>Research and publications</h2>
          <div>
            <p>
              Explore frameworks for rural equity, public governance and health
              systems assurance by Oluwabiyi Adeyemo.
            </p>
            <p>
              Publication pages provide the author, edition and available
              bibliographic details. Confirm your email to access a requested
              publication; future updates are optional.
            </p>
            <a className="hs-link" href="/publications">
              Browse publications
              <ArrowRight size={24} aria-hidden="true" />
            </a>
          </div>
        </section>
        <section className="hs-work-row">
          <h2>County-level planning</h2>
          <div>
            <p>
              CB-CAP, the County-Based Community Access Platform, is a separate
              Foundation product. Explore its county planning experience and
              evidence on its own site.
            </p>
            <a className="hs-link" href="https://cbcap.sozorockfoundation.org/">
              Explore CB-CAP
              <ArrowRight size={24} aria-hidden="true" />
            </a>
          </div>
        </section>
        <aside className="hs-context">
          <h2>A question the evidence cannot answer yet?</h2>
          <p>
            Tell us what you are trying to understand. A missing value or
            unavailable source should remain visible, rather than be treated as
            an answer.
          </p>
          <a
            className="hs-link"
            href="/contact?interest=Research%20partnership"
          >
            Discuss a research question
            <ArrowRight size={22} aria-hidden="true" />
          </a>
        </aside>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(healthPageSchema("Evidence", "/evidence")),
        }}
      />
    </HealthShell>
  );
}
