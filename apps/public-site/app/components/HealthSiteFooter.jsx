import { counterpartPath } from "../lib/language-paths";

const F = "https://www.sozorockfoundation.org";
const CBCAP = "https://cbcap.sozorockfoundation.org/";

const COPY = {
  en: {
    home: "/", homeLabel: "SozoRock Health home",
    tagline: <>Care. For every ZIP Code.<br />An initiative of The SozoRock Foundation, Inc.</>,
    columns: [
      ["Our work", [["Health Equity Hubs", "/work#hubs"], ["Health Access Day", "/work#health-access-day"], ["Primary Care Access Program", "/primary-care-access"], ["Place Intelligence", "/explore"], ["CB-CAP County Planning", CBCAP]]],
      ["Research", [["All Research", "/publications"], ["Rural Equity Blueprint", "/publications/rural-equity-blueprint-volume-1"], ["Rethinking Rural Governance", "/publications/rethinking-rural-governance-volume-1"], ["Health Systems Assurance", "/publications/health-systems-assurance-volume-1"], ["Data and Methods", "/evidence"]]],
      ["Work with us", [["For Residents", "/interest"], ["For Providers", "/contact"], ["For Counties", "/explore"], ["For Funders", `${F}/support`], ["Contact Us", "/contact"]]],
      ["The Foundation", [["About the Foundation", `${F}/about`], ["Leadership", `${F}/leadership`], ["Support Our Work", `${F}/support`], ["Our Standards", `${F}/standards`]]],
    ],
    legalLabel: "Legal",
    legal: [["Privacy Notice", "/privacy"], ["Terms of Use", "/terms"], ["Accessibility Statement", "/accessibility"], ["Nondiscrimination Notice", "/nondiscrimination"], ["Contact Us", "/contact"]],
    other: ["Español", "es"],
    care: "SozoRock Health does not provide medical care. All care is delivered by licensed providers. Direct primary care membership is not health insurance.",
    legalLine: "© 2026 The SozoRock Foundation, Inc. A 501(c)(3) public charity. EIN 39-4736725.",
    note: null,
  },
  es: {
    home: "/es", homeLabel: "Inicio de SozoRock Health",
    tagline: <>Atención médica. Para cada código postal.<br />Una iniciativa de The SozoRock Foundation, Inc.</>,
    columns: [
      ["Nuestro trabajo", [["Health Equity Hubs", "/work#hubs"], ["Health Access Day", "/work#health-access-day"], ["Programa de Acceso a la Atención Primaria", "/es/primary-care-access"], ["Place Intelligence", "/explore"], ["Planificación de condados CB-CAP", CBCAP]]],
      ["Investigación", [["Toda la investigación", "/publications"], ["Rural Equity Blueprint", "/publications/rural-equity-blueprint-volume-1"], ["Rethinking Rural Governance", "/publications/rethinking-rural-governance-volume-1"], ["Health Systems Assurance", "/publications/health-systems-assurance-volume-1"], ["Datos y métodos", "/evidence"]]],
      ["Colabore con nosotros", [["Para residentes", "/interest"], ["Para proveedores", "/contact"], ["Para condados", "/explore"], ["Para financiadores", `${F}/support`], ["Contáctenos", "/contact"]]],
      ["La Fundación", [["Acerca de la Fundación", `${F}/about`], ["Liderazgo", `${F}/leadership`], ["Apoye nuestro trabajo", `${F}/support`], ["Nuestros estándares", `${F}/standards`]]],
    ],
    legalLabel: "Información legal",
    legal: [["Aviso de privacidad", "/es/privacy"], ["Condiciones de uso", "/es/terms"], ["Declaración de accesibilidad", "/es/accessibility"], ["Aviso de no discriminación", "/es/nondiscrimination"], ["Contáctenos", "/contact"]],
    other: ["English", "en"],
    care: "SozoRock Health no presta atención médica. Toda la atención la brindan proveedores con licencia. La membresía de atención primaria directa no es un seguro médico.",
    legalLine: "© 2026 The SozoRock Foundation, Inc. Organización benéfica pública 501(c)(3). EIN 39-4736725.",
    note: "El programa y los avisos legales están en español; las demás páginas están en inglés. Si necesita ayuda en español, escríbanos a contact@sozorockfoundation.org.",
  },
};

/** @param {{spanish?: boolean, path?: string}} props */
export function HealthSiteFooter({ spanish = false, path }) {
  const t = spanish ? COPY.es : COPY.en;
  return <footer className="hf">
    <div className="hf-top">
      <div className="hf-brand">
        <a href={t.home} aria-label={t.homeLabel}>SozoRock<sup className="hx-reg">®</sup> Health</a>
        <p>{t.tagline}</p>
      </div>
      {t.columns.map(([title, links]) => <nav key={title} aria-label={title}>
        <h2>{title}</h2>
        <ul>{links.map(([text, href]) => <li key={text}><a href={href}>{text}</a></li>)}</ul>
      </nav>)}
    </div>
    <div className="hf-bottom">
      <nav aria-label={t.legalLabel}>
        <ul>{t.legal.map(([text, href]) => <li key={href + text}><a href={href}>{text}</a></li>)}<li><a href={counterpartPath(path ?? (spanish ? "/es" : "/"), spanish)} lang={t.other[1]} hrefLang={t.other[1]}>{t.other[0]}</a></li></ul>
      </nav>
      {t.note && <p>{t.note}</p>}
      <p>{t.care}</p>
      <p>{t.legalLine}</p>
    </div>
  </footer>;
}
