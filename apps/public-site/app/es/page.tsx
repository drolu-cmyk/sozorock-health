import type { Metadata } from "next";
import {
  ArrowRight,
  EnvelopeSimple,
  HandHeart,
  Heartbeat,
  MapPin,
  Path,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { ContactForm } from "../components/ContactForm";
import { HeroPathVisual } from "../components/HeroPathVisual";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";

export const metadata: Metadata = {
  title: "Un camino más claro hacia la atención que ya existe",
  description:
    "SozoRock Health desarrolla infraestructura no clínica de acceso a la salud, preparación laboral y sistemas para comunidades rurales y desatendidas de Estados Unidos.",
  alternates: {
    canonical: "/es",
    languages: { "en-US": "/", "es-US": "/es" },
  },
  openGraph: {
    title: "SozoRock Health | Un camino más claro hacia la atención",
    description:
      "Infraestructura de interés público para el acceso no clínico a la salud, la preparación comunitaria y sistemas públicos más sólidos.",
    url: "/es",
    siteName: "SozoRock Health",
    type: "website",
    locale: "es_US",
    alternateLocale: ["en_US"],
    images: [{
      url: "/social/sozorock-health-og.jpg",
      width: 1200,
      height: 630,
      alt: "Un camino ilustrado avanza desde la incertidumbre hacia apoyo local bajo el mensaje de SozoRock Health",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SozoRock Health | Un camino más claro hacia la atención",
    description: "Infraestructura de interés público para el acceso no clínico a la salud, la preparación comunitaria y sistemas públicos más sólidos.",
    images: ["/social/sozorock-health-og.jpg"],
  },
};

const priorities = [
  ["Salud cardiovascular", "Prioridad emergente", "emerging-priority"],
  ["Diabetes y salud metabólica", "Trabajo actual", "current-work"],
  ["Concientización sobre el cáncer y acceso a pruebas de detección", "Abierto a colaboración", "open-for-partnership"],
  ["Salud materna y familiar", "Abierto a colaboración", "open-for-partnership"],
  ["Salud mental y conductual", "Prioridad emergente", "emerging-priority"],
  ["Salud renal", "Abierto a colaboración", "open-for-partnership"],
  ["Salud respiratoria", "Abierto a colaboración", "open-for-partnership"],
  ["Envejecimiento saludable", "Prioridad emergente", "emerging-priority"],
  ["Prevención y detección temprana", "Trabajo actual", "current-work"],
  ["Alfabetización en salud", "Trabajo actual", "current-work"],
  ["Acceso a la salud digital", "Trabajo actual", "current-work"],
  ["Acceso a la atención médica rural", "Trabajo actual", "current-work"],
] as const;

const involvement = [
  [
    "Colabore con nosotros",
    "Desarrolle una vía práctica en torno a una necesidad comunitaria o institucional.",
  ],
  [
    "Financie el trabajo",
    "Apoye la implementación, la investigación, la educación pública o la tecnología responsable.",
  ],
  [
    "Voluntariado",
    "Aporte tiempo y experiencia dentro de una función no clínica claramente definida.",
  ],
  [
    "Apoye las publicaciones",
    "Ayude a ampliar la investigación de interés público y la orientación práctica.",
  ],
  [
    "Lleve el modelo a una comunidad",
    "Inicie una conversación de preparación para un Health Equity Hub o Health Access Day.",
  ],
  [
    "Consulta del sector público",
    "Explore la colaboración con condados, estados, universidades u organismos públicos.",
  ],
] as const;

export default function SpanishHome() {
  return (
    <div lang="es">
      <a className="skip-link" href="#main-content">
        Ir al contenido
      </a>
      <SiteHeader locale="es" />

      <main id="main-content" tabIndex={-1}>
        <section className="new-hero" aria-labelledby="hero-heading">
          <div className="new-hero__copy">
            <p className="eyebrow">Iniciativa sin fines de lucro para el acceso a la salud</p>
            <h1 id="hero-heading">
              Un camino más claro hacia la atención que ya existe.
            </h1>
            <p className="hero-summary">
              SozoRock Health ayuda a las personas a convertir la incertidumbre
              en próximos pasos prácticos, mientras la atención clínica
              permanece en manos de profesionales con licencia.
            </p>
            <a className="button button--clay" href="#model">
              Explorar el modelo <ArrowRight size={17} aria-hidden="true" />
            </a>
            <p className="boundary">
              No es una clínica. No es un proveedor. No es una plataforma de telesalud.
            </p>
          </div>
          <HeroPathVisual
            label="Una ruta ilustrada avanza desde la incertidumbre, pasa por puntos de referencia comunitarios y llega a un destino claro"
            caption="De la incertidumbre a un próximo paso práctico."
          />
        </section>

        <section className="problem-band" aria-labelledby="problem-heading">
          <div className="section-heading section-heading--compact">
            <p className="eyebrow">El problema</p>
            <h2 id="problem-heading">
              La atención puede existir. El camino hacia ella puede no estar claro.
            </h2>
          </div>
          <div className="problem-points">
            <article>
              <Path size={30} aria-hidden="true" />
              <h3>Saber por dónde empezar</h3>
            </article>
            <article>
              <MapPin size={30} aria-hidden="true" />
              <h3>Encontrar el recurso local adecuado</h3>
            </article>
            <article>
              <Heartbeat size={30} aria-hidden="true" />
              <h3>Llegar a la atención apropiada</h3>
            </article>
          </div>
        </section>

        <section className="model-section" id="model" aria-labelledby="model-heading">
          <div className="section-heading">
            <p className="eyebrow">La capa práctica</p>
            <h2 id="model-heading">
              Orientación práctica entre la incertidumbre y la atención apropiada.
            </h2>
            <p>
              SozoRock Health ayuda a personas e instituciones a utilizar mejor
              los sistemas existentes de atención médica, salud pública,
              tecnología digital y apoyo comunitario.
            </p>
          </div>
          <ol className="pathway" aria-label="Cómo funciona el modelo de SozoRock Health">
            <li>
              <span>Comenzar</span>
              <div>
                <h3>Comprender la necesidad</h3>
                <p>Aclarar la pregunta inmediata y las barreras prácticas que la rodean.</p>
              </div>
            </li>
            <li>
              <span>Orientar</span>
              <div>
                <h3>Identificar opciones apropiadas</h3>
                <p>Encontrar servicios, recursos, preparación o apoyo comunitario útiles.</p>
              </div>
            </li>
            <li>
              <span>Conectar</span>
              <div>
                <h3>Llegar al destino adecuado</h3>
                <p>Conectar con un recurso comunitario o un profesional con licencia cuando sea necesario.</p>
              </div>
            </li>
          </ol>
          <div className="model-boundary">
            <ShieldCheck size={28} aria-hidden="true" />
            <p>
              <strong>La atención clínica permanece con profesionales con licencia.</strong>{" "}
              SozoRock Health no diagnostica, trata, prescribe ni toma decisiones clínicas.
            </p>
          </div>
        </section>

        <section className="systems-section" aria-labelledby="systems-heading">
          <div className="section-heading section-heading--split">
            <div>
              <p className="eyebrow eyebrow--light">Modelo de sistemas</p>
              <h2 id="systems-heading">Un modelo. Cuatro capas conectadas.</h2>
            </div>
            <p>
              El apoyo a residentes, la atención con licencia, la planificación
              pública y la preparación institucional permanecen separados,
              pero pueden funcionar mejor juntos.
            </p>
          </div>
          <div className="systems-grid">
            <article>
              <span>Capa para residentes</span>
              <h3>Preparación y apoyo no clínico</h3>
              <p>Health Equity Hubs, Health Access Day, Voice Access y preparación digital ayudan a las personas a usar servicios existentes.</p>
            </article>
            <article>
              <span>Capa de proveedores</span>
              <h3>Vías dirigidas por proveedores</h3>
              <p>Los profesionales con licencia conservan sus sistemas clínicos, expedientes, criterios profesionales y atención.</p>
            </article>
            <article>
              <span>Capa del condado</span>
              <h3>County-Based Community Access Platform (CB-CAP)</h3>
              <p>La información desidentificada sobre vías apoya la visibilidad de brechas, la planificación y el trabajo de CHA y CHIP.</p>
            </article>
            <article>
              <span>Capa de preparación</span>
              <h3>Instituciones preparadas para actuar</h3>
              <p>La preparación para IA y ciberseguridad, la modernización pública y el desarrollo laboral apoyan una implementación responsable.</p>
            </article>
          </div>
        </section>

        <section className="priorities-section" id="priorities" aria-labelledby="priorities-heading">
          <div className="section-heading section-heading--split">
            <div>
              <p className="eyebrow eyebrow--light">Prioridades de salud</p>
              <h2 id="priorities-heading">
                Un marco preparado para distintas necesidades comunitarias.
              </h2>
            </div>
            <p>
              Las etiquetas distinguen el trabajo actual de las áreas en
              desarrollo o abiertas a colaboración. No afirman que existan
              programas que aún no se han establecido.
            </p>
          </div>
          <div className="priority-legend" aria-label="Leyenda del estado de las prioridades">
            <span>Trabajo actual</span>
            <span>Prioridad emergente</span>
            <span>Abierto a colaboración</span>
          </div>
          <div className="priority-grid">
            {priorities.map(([name, status, statusClass]) => (
              <article key={name}>
                <span className={`status status--${statusClass}`}>{status}</span>
                <h3>{name}</h3>
              </article>
            ))}
          </div>
        </section>

        <section className="publications-section" id="publications" aria-labelledby="publications-heading">
          <div className="section-heading">
            <p className="eyebrow">Publicaciones</p>
            <h2 id="publications-heading">Ideas que orientan el trabajo.</h2>
            <p>
              Las publicaciones de Oluwabiyi Adeyemo examinan cómo el acceso a
              la salud, los sistemas públicos, la tecnología y la rendición de
              cuentas pueden trabajar juntos.
            </p>
          </div>
          <div className="publication-shelf">
            <article>
              <Image
                src="/publications/covers/rural-equity-blueprint-volume-1.png"
                width={1320}
                height={1688}
                alt="Portada de Rural Equity Blueprint Series, Volume 1: Access Day"
                sizes="(max-width: 600px) 130px, 280px"
              />
              <div>
                <span>Disponible</span>
                <h3>Rural Equity Blueprint Series, Volume 1</h3>
                <p>Un marco práctico para alfabetización en salud, preparación, equidad de acceso y activación comunitaria.</p>
                <a href="/publications/rural-equity-blueprint-volume-1">
                  Acceder a la publicación <ArrowRight size={15} aria-hidden="true" />
                </a>
              </div>
            </article>
            <article>
              <Image
                src="/publications/covers/rethinking-rural-governance-volume-1.png"
                width={1275}
                height={1650}
                alt="Portada de Rethinking Rural Governance, Volume 1"
                sizes="(max-width: 600px) 130px, 280px"
              />
              <div>
                <span>Disponible</span>
                <h3>Rethinking Rural Governance, Volume 1</h3>
                <p>Una base de gobernanza para sistemas públicos proactivos, responsables y mejor informados.</p>
                <a href="/publications/rethinking-rural-governance-volume-1">
                  Acceder a la publicación <ArrowRight size={15} aria-hidden="true" />
                </a>
              </div>
            </article>
          </div>
        </section>

        <section className="assurance-section" aria-labelledby="assurance-heading">
          <div>
            <p className="eyebrow eyebrow--light">En desarrollo</p>
            <h2 id="assurance-heading">Health Systems Assurance</h2>
            <p>Garantía digital, gobernanza e infraestructura de salud habilitada por IA</p>
          </div>
          <div className="assurance-sequence" aria-label="Secuencia de Health Systems Assurance">
            <span>Educación</span>
            <ArrowRight aria-hidden="true" />
            <span>Implementación</span>
            <ArrowRight aria-hidden="true" />
            <span>Verificación</span>
            <ArrowRight aria-hidden="true" />
            <span>Confianza</span>
          </div>
          <p>Para organismos públicos, proveedores, investigadores, instituciones comunitarias y responsables de sistemas digitales seguros y transparentes.</p>
          <a href="/publications/health-systems-assurance">
            Ver la serie <ArrowRight size={15} aria-hidden="true" />
          </a>
        </section>

        <section className="leadership-section" id="about" aria-labelledby="leadership-heading">
          <div className="leadership-editorial">
            <span>Estrategia</span>
            <span>Investigación</span>
            <span>Implementación</span>
            <span>Sistemas públicos</span>
          </div>
          <div>
            <p className="eyebrow">Liderazgo</p>
            <h2 id="leadership-heading">Diseñado y dirigido por Oluwabiyi Adeyemo.</h2>
            <p>Oluwabiyi dirige la estrategia de SozoRock Health, integrando acceso a la salud, investigación, tecnología, desarrollo laboral y preparación de los sistemas públicos.</p>
            <p className="leadership-role">
              <strong>Director of Strategic Initiatives</strong><br />
              The SozoRock Foundation, Inc.
            </p>
            <div className="leadership-links">
              <a href="https://sozorockfoundation.org/about-us" target="_blank" rel="noreferrer">
                Ver perfil completo <ArrowRight size={15} aria-hidden="true" />
              </a>
              <span>Publicaciones seleccionadas</span>
              <a href="/publications/rural-equity-blueprint-volume-1">Rural Equity Blueprint, Volume 1</a>
              <a href="/publications/rethinking-rural-governance-volume-1">Rethinking Rural Governance, Volume 1</a>
            </div>
          </div>
        </section>

        <section className="foundation-statement" aria-label="Acerca de The SozoRock Foundation">
          <p>The SozoRock Foundation desarrolla formas prácticas de mejorar el acceso a la salud, fortalecer los sistemas públicos y preparar a las comunidades para cambios duraderos.</p>
          <span>SozoRock Health es una iniciativa de The SozoRock Foundation, Inc., una organización sin fines de lucro 501(c)(3) con sede en Nueva York.</span>
        </section>

        <section className="involved-section" id="get-involved" aria-labelledby="involved-heading">
          <div className="section-heading">
            <p className="eyebrow">Participe</p>
            <h2 id="involved-heading">Elija cómo desea ayudar.</h2>
            <p>Comience con su objetivo. El formulario solicitará únicamente la información relevante para ese camino.</p>
          </div>
          <div className="involvement-grid">
            {involvement.map(([title, copy]) => (
              <a key={title} href="#inquiry-form">
                <HandHeart size={27} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{copy}</p>
                <span>Comenzar <ArrowRight size={14} aria-hidden="true" /></span>
              </a>
            ))}
          </div>
          <div id="inquiry-form" className="inquiry-layout">
            <div>
              <h3>Cuéntenos qué desea lograr.</h3>
              <p>No incluya información médica, de emergencias o de salud protegida.</p>
              <a href="mailto:contact@sozorockfoundation.org">
                <EnvelopeSimple size={17} aria-hidden="true" />
                contact@sozorockfoundation.org
              </a>
            </div>
            <ContactForm locale="es" />
          </div>
        </section>
      </main>

      <SiteFooter locale="es" />
    </div>
  );
}
