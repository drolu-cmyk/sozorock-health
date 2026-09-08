import { ArrowRight, Plus, Minus } from "@phosphor-icons/react/dist/ssr";
import { HealthShell } from "./HealthShell";
import { healthPageSchema } from "../lib/health-metadata";

const capabilities = [
  [
    "Community access",
    "Health Equity Hubs, Health Access Day and practical support around reaching care.",
    "hubs",
    "community-access",
  ],
  [
    "Evidence and intelligence",
    "Place-based evidence and research to help institutions understand local barriers and examine their response.",
    "cbcap",
    "evidence-intelligence",
  ],
  [
    "Digital readiness and assurance",
    "Practical readiness, cybersecurity and evidence-based assurance for digital health systems.",
    "byop",
    "digital-readiness",
  ],
  [
    "Workforce capacity",
    "Education and partnership pathways informed by the capabilities a community needs.",
    "workforce",
    "workforce-capacity",
  ],
];
const spanishCapabilities = [
  [
    "Acceso comunitario",
    "Health Equity Hubs, Health Access Day y apoyo práctico para facilitar el acceso a la atención.",
    "hubs",
    "community-access",
  ],
  [
    "Evidencia e inteligencia",
    "Evidencia territorial e investigación para comprender las barreras locales y orientar la respuesta institucional.",
    "cbcap",
    "evidence-intelligence",
  ],
  [
    "Preparación y aseguramiento digital",
    "Preparación práctica, ciberseguridad y aseguramiento basado en evidencia para los sistemas de salud digitales.",
    "byop",
    "digital-readiness",
  ],
  [
    "Capacidad laboral",
    "Educación y colaboración orientadas a las capacidades que necesita cada comunidad.",
    "workforce",
    "workforce-capacity",
  ],
];

export function HealthHome({ spanish = false }: { spanish?: boolean }) {
  const title = spanish
    ? "Construimos los sistemas que hacen posible el acceso a la salud."
    : "Building the systems that make health access possible.";
  return (
    <HealthShell spanish={spanish}>
      <main id="health-main">
        <section className="hs-opening" aria-labelledby="health-title">
          <div className="hs-intro">
            <h1 id="health-title">{title}</h1>
            <p className="hs-lead">
              {spanish
                ? "SozoRock Health desarrolla modelos de acceso comunitario, inteligencia territorial, aseguramiento digital y capacidad laboral para fortalecer los sistemas de salud y su rendición de cuentas."
                : "SozoRock Health develops community access models, place-based intelligence, digital assurance and workforce capacity to help institutions build more accountable health systems."}
            </p>
            <div className="hs-actions">
              <a className="hs-primary" href="/work">
                {spanish ? "Nuestro trabajo" : "Explore our work"}
                <ArrowRight size={24} aria-hidden="true" />
              </a>
              <a className="hs-link" href="/contact">
                {spanish
                  ? "Hablemos de una colaboración"
                  : "Discuss a partnership"}
                <ArrowRight size={24} aria-hidden="true" />
              </a>
            </div>
            <p className="hs-boundary">
              {spanish
                ? "El diagnóstico, el tratamiento y la prescripción corresponden a profesionales autorizados."
                : "Diagnosis, treatment and prescribing remain with licensed practitioners."}
            </p>
          </div>
          <div className="hs-capabilities" id="what-we-do">
            <h2>
              {spanish ? (
                <>
                  Un propósito.
                  <br />
                  Capacidades conectadas.
                </>
              ) : (
                <>
                  One purpose.
                  <br />
                  Connected capabilities.
                </>
              )}
            </h2>
            {(spanish ? spanishCapabilities : capabilities).map(
              ([name, text, id, anchor], index) => (
                <details
                  key={id}
                  name="health-capability"
                  id={id}
                  open={index === 0}
                >
                  <summary>
                    <span>{name}</span>
                    <Plus className="hs-plus" size={24} aria-hidden="true" />
                    <Minus className="hs-minus" size={24} aria-hidden="true" />
                  </summary>
                  <div className="hs-capability-detail">
                    <p>{text}</p>
                    <a href={`/work#${anchor}`}>
                      {spanish ? "Explorar esta área" : "Explore this area"}
                      <ArrowRight size={20} aria-hidden="true" />
                    </a>
                  </div>
                </details>
              ),
            )}
          </div>
        </section>
        <section
          className="hs-evidence-entry"
          id="place-search"
          aria-labelledby="evidence-title"
        >
          <h2 id="evidence-title">
            {spanish
              ? "Comprender el lugar antes de diseñar la respuesta."
              : "Understand the place before shaping the response."}
          </h2>
          <div>
            <a href="/explore" className="hs-link">
              Place Intelligence
              <ArrowRight size={25} aria-hidden="true" />
            </a>
            <p>
              {spanish
                ? "Explore la evidencia local y sus fuentes. Interfaz en inglés."
                : "Explore local evidence and its sources."}
            </p>
          </div>
          <div id="publications">
            <a href="/publications" className="hs-link">
              {spanish ? "Publicaciones" : "Publications"}
              <ArrowRight size={25} aria-hidden="true" />
            </a>
            <p>
              {spanish
                ? "Lea la investigación que orienta el trabajo."
                : "Read the research behind the work."}
            </p>
          </div>
        </section>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            healthPageSchema(title, spanish ? "/es" : "/"),
          ),
        }}
      />
    </HealthShell>
  );
}
