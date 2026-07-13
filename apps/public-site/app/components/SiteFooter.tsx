import {
  GlobeHemisphereWest,
  InstagramLogo,
  XLogo,
  YoutubeLogo,
} from "@phosphor-icons/react/dist/ssr";
import { LogoLockup } from "./LogoLockup";

type Locale = "en" | "es";

const footerContent = {
  en: {
    description:
      "A national public-interest initiative developing non-clinical health access, workforce-readiness, and systems infrastructure for people, communities, institutions, and public agencies.",
    groups: [
      {
        heading: "Explore",
        links: [
          ["What We Do", "#model"],
          ["Health Priorities", "#priorities"],
          ["Publications", "#publications"],
          ["About", "#about"],
        ],
      },
      {
        heading: "Take part",
        links: [
          ["Partner", "#get-involved"],
          ["Fund the work", "#get-involved"],
          ["Volunteer", "#get-involved"],
          ["Public-sector inquiry", "#get-involved"],
        ],
      },
      {
        heading: "Policies",
        links: [
          ["Privacy", "/privacy"],
          ["Accessibility", "/accessibility"],
          ["Nondiscrimination", "/nondiscrimination"],
          ["Terms", "/terms"],
        ],
      },
    ],
    trademark:
      "SozoRock® is a registered trademark of SozoRock Tech Inc., used under license by The SozoRock Foundation, Inc.",
    disclosure:
      "The SozoRock Foundation, Inc. is a nonprofit, tax-exempt charitable organization under Section 501(c)(3) of the Internal Revenue Code. EIN 39-4736725. Donations are tax-deductible as allowed by law.",
    rights: "All rights reserved.",
    social: "SozoRock Foundation on",
  },
  es: {
    description:
      "Una iniciativa nacional de interés público que desarrolla infraestructura no clínica de acceso a la salud, preparación laboral y sistemas para personas, comunidades, instituciones y organismos públicos.",
    groups: [
      {
        heading: "Explore",
        links: [
          ["Qué hacemos", "#model"],
          ["Prioridades de salud", "#priorities"],
          ["Publicaciones", "#publications"],
          ["Acerca de", "#about"],
        ],
      },
      {
        heading: "Participe",
        links: [
          ["Colabore", "#get-involved"],
          ["Financie el trabajo", "#get-involved"],
          ["Voluntariado", "#get-involved"],
          ["Consulta del sector público", "#get-involved"],
        ],
      },
      {
        heading: "Políticas",
        links: [
          ["Privacidad", "/privacy"],
          ["Accesibilidad", "/accessibility"],
          ["No discriminación", "/nondiscrimination"],
          ["Términos", "/terms"],
        ],
      },
    ],
    trademark:
      "SozoRock® es una marca registrada de SozoRock Tech Inc., utilizada bajo licencia por The SozoRock Foundation, Inc.",
    disclosure:
      "The SozoRock Foundation, Inc. es una organización benéfica sin fines de lucro exenta de impuestos conforme a la Sección 501(c)(3) del Código de Rentas Internas. EIN 39-4736725. Las donaciones son deducibles de impuestos según lo permita la ley.",
    rights: "Todos los derechos reservados.",
    social: "SozoRock Foundation en",
  },
} satisfies Record<Locale, {
  description: string;
  groups: { heading: string; links: [string, string][] }[];
  trademark: string;
  disclosure: string;
  rights: string;
  social: string;
}>;

export function SiteFooter({ locale = "en" }: { locale?: Locale }) {
  const copy = footerContent[locale];

  return (
    <footer className="new-footer" lang={locale}>
      <div className="new-footer__lead">
        <LogoLockup inverse href="#top" locale={locale} />
        <p>{copy.description}</p>
      </div>
      <div className="new-footer__links">
        {copy.groups.map((group) => (
          <div key={group.heading}>
            <h2>{group.heading}</h2>
            {group.links.map(([label, href]) => (
              <a href={href} key={label}>
                {label}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="new-footer__contact">
        <a
          href="https://x.com/srockfoundation"
          aria-label={`${copy.social} X`}
        >
          <XLogo size={20} aria-hidden="true" />
        </a>
        <a
          href="https://www.youtube.com/@srockfoundation"
          aria-label={`${copy.social} YouTube`}
        >
          <YoutubeLogo size={20} aria-hidden="true" />
        </a>
        <a
          href="https://www.instagram.com/srockfoundation/"
          aria-label={`${copy.social} Instagram`}
        >
          <InstagramLogo size={20} aria-hidden="true" />
        </a>
        <a href="https://www.sozorockfoundation.org">
          <GlobeHemisphereWest size={20} aria-hidden="true" />
          sozorockfoundation.org
        </a>
      </div>
      <div className="new-footer__legal">
        <p>{copy.trademark}</p>
        <p>{copy.disclosure}</p>
        <small>
          © {new Date().getFullYear()} The SozoRock Foundation, Inc. {copy.rights}
        </small>
      </div>
    </footer>
  );
}
