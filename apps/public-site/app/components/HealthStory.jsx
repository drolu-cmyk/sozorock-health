import { StateGapMap } from "./StateGapMap";

const R = <sup className="hx-reg">®</sup>;
const SUPPORT = "https://www.sozorockfoundation.org/support";
const covers = [
  { title: "Rural Equity Blueprint", href: "/publications/rural-equity-blueprint-volume-1", src: "/media/health-home/rebs-cover.webp", w: 640, h: 905 },
  { title: "Rethinking Rural Governance", href: "/publications/rethinking-rural-governance-volume-1", src: "/media/health-home/rrg-cover.webp", w: 640, h: 828 },
  { title: "Health Systems Assurance", href: "/publications/health-systems-assurance-volume-1", src: "/media/health-home/hsa-cover.webp", w: 640, h: 828 },
];

const COPY = {
  en: {
    label: "Care. For every ZIP Code.",
    h1: "Care is too few, too far and too hard to reach.",
    promise: "We help change all three.",
    gapsLabel: "Three gaps between people and care",
    gaps: [
      { word: "Too few", pct: 53, line: "of primary care need goes unmet where providers are short", source: "HRSA, September 30, 2026" },
      { word: "Too far", pct: 28, line: "of rural adults have no broadband at home", source: "Pew Research Center, 2026" },
      { word: "Too hard", pct: 88, line: "of adults lack proficient health literacy", source: "U.S. Department of Health and Human Services" },
    ],
    few: { word: "Too few", title: "Providers are short and waits are long.", covers: "Provider shortages, wait times, a shrinking health workforce and an aging population.", answer: "We give counties clear local data to plan for the care their residents need.", links: [["Place Intelligence", "/explore"], ["CB-CAP county planning", "https://cbcap.sozorockfoundation.org/"]] },
    far: { word: "Too far", title: "Distance, cost and no connection keep care out of reach.", covers: "Distance, transportation, no device or internet, no private place and cost.", answer: "Health Equity Hubs bring a private place, a device and secure Wi‑Fi close to home. When cost stands in the way, we sponsor a year of primary care.", links: [["Health Equity Hubs", "/work#hubs"], ["Primary Care Access Program", "/primary-care-access"]] },
    hubs: { ends: ["In a public space", "At home"], items: [["Library", "By appointment"], ["Community", "At scheduled events"], ["Home", "In development"]], caption: "Each visit runs on the provider’s own platform. The visit and the record stay with the provider." },
    hard: { word: "Too hard", title: "Language and late diagnosis keep care from working.", covers: "Language, translation, health literacy, prevention not reached and chronic illness found late.", answer: "Health Access Day brings health education, interpretation and screenings by licensed providers to the ZIP Codes where chronic illness runs highest.", links: [["Health Access Day", "/work#health-access-day"]] },
    venn: { label: "Health Access Day sits where high chronic illness, low access and local health priorities overlap", parts: ["High chronic illness", "Low access", "Local health priorities"] },
    youTitle: "What it means for you",
    audiences: [
      { who: "Residents", what: "A way in to care near you, in your language.", cta: "Join the interest list", href: "/interest" },
      { who: "Providers", what: "Reach the people you are missing.", cta: "Tell us about your practice", href: "/contact?audience=providers" },
      { who: "Counties", what: "Local data for your community health plan.", cta: "Find your county", href: "/explore" },
      { who: "Funders", what: "Measurable access where need is highest.", cta: "Support the work", href: SUPPORT },
    ],
    care: <>SozoRock{R} Health does not provide medical care. All care is delivered by licensed providers.</>,
    researchLabel: "Research",
    researchTitle: "Three ideas behind every program.",
    researchLink: "Read the research",
    ideas: ["Put care where people already go: the library, the community center and the home.", "Counties already hold the data they need to plan health. Connect it.", "Digital health earns trust when it is tested, not assumed."],
    cover: (t) => `${t}, Volume 1 cover`,
    foundation: "Part of The SozoRock Foundation: access, capacity and trust.",
    foundationLink: "Visit the Foundation",
  },
  es: {
    label: "Atención médica. Para cada código postal.",
    h1: "La atención médica es muy escasa, está muy lejos y es muy difícil de obtener.",
    promise: "Ayudamos a cambiar las tres cosas.",
    gapsLabel: "Tres brechas entre las personas y la atención médica",
    gaps: [
      { word: "Muy escasa", pct: 53, line: "de la necesidad de atención primaria queda sin cubrir donde faltan proveedores", source: "HRSA, 30 de septiembre de 2026" },
      { word: "Muy lejos", pct: 28, line: "de los adultos en zonas rurales no tiene internet de banda ancha en casa", source: "Pew Research Center, 2026" },
      { word: "Muy difícil", pct: 88, line: "de los adultos no tiene un nivel competente de alfabetización en salud", source: "Departamento de Salud y Servicios Humanos de EE. UU." },
    ],
    few: { word: "Muy escasa", title: "Faltan proveedores y las esperas son largas.", covers: "Escasez de proveedores, tiempos de espera, menos personal de salud y una población que envejece.", answer: "Damos a los condados datos locales claros para planificar la atención que necesitan sus residentes.", links: [["Place Intelligence", "/explore"], ["Planificación de condados CB-CAP", "https://cbcap.sozorockfoundation.org/"]] },
    far: { word: "Muy lejos", title: "La distancia, el costo y la falta de conexión alejan la atención.", covers: "Distancia, transporte, falta de un dispositivo o de internet, falta de un lugar privado y costo.", answer: "Los Health Equity Hubs ofrecen un lugar privado, un dispositivo y wifi seguro cerca de casa. Cuando el costo es un obstáculo, patrocinamos un año de atención primaria.", links: [["Health Equity Hubs", "/work#hubs"], ["Programa de Acceso a la Atención Primaria", "/primary-care-access"]] },
    hubs: { ends: ["En un espacio público", "En casa"], items: [["Biblioteca", "Con cita previa"], ["Comunidad", "En eventos programados"], ["Hogar", "En desarrollo"]], caption: "Cada consulta se realiza en la plataforma del propio proveedor. La consulta y el expediente quedan con el proveedor." },
    hard: { word: "Muy difícil", title: "El idioma y los diagnósticos tardíos impiden que la atención funcione.", covers: "Idioma, traducción, alfabetización en salud, prevención que no llega y enfermedades crónicas detectadas tarde.", answer: "Health Access Day lleva educación en salud, interpretación y pruebas de detección a cargo de proveedores con licencia a los códigos postales con más enfermedades crónicas.", links: [["Health Access Day", "/work#health-access-day"]] },
    venn: { label: "Health Access Day se ubica donde coinciden muchas enfermedades crónicas, poco acceso y las prioridades locales de salud", parts: ["Muchas enfermedades crónicas", "Poco acceso", "Prioridades locales de salud"] },
    youTitle: "Lo que significa para usted",
    audiences: [
      { who: "Residentes", what: "Una forma de acceder a la atención cerca de usted, en su idioma.", cta: "Únase a la lista de interés", href: "/interest" },
      { who: "Proveedores", what: "Llegue a las personas que hoy no alcanza.", cta: "Cuéntenos sobre su práctica", href: "/contact?audience=providers" },
      { who: "Condados", what: "Datos locales para su plan de salud comunitaria.", cta: "Busque su condado", href: "/explore" },
      { who: "Financiadores", what: "Acceso medible donde la necesidad es mayor.", cta: "Apoye este trabajo", href: SUPPORT },
    ],
    care: <>SozoRock{R} Health no presta atención médica. Toda la atención la brindan proveedores con licencia.</>,
    researchLabel: "Investigación",
    researchTitle: "Tres ideas detrás de cada programa.",
    researchLink: "Lea la investigación (en inglés)",
    ideas: ["Llevar la atención a donde la gente ya va: la biblioteca, el centro comunitario y el hogar.", "Los condados ya tienen los datos que necesitan para planificar la salud. Falta conectarlos.", "La salud digital se gana la confianza cuando se pone a prueba, no cuando se da por sentada."],
    cover: (t) => `Portada de ${t}, volumen 1`,
    foundation: "Parte de The SozoRock Foundation: acceso, capacidad y confianza.",
    foundationLink: "Visite la Fundación",
  },
};

function Donut({ pct }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return <svg className="hx-donut" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
    <circle cx="64" cy="64" r={r} className="hx-donut-track" />
    <circle cx="64" cy="64" r={r} className="hx-donut-fill" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 64 64)" />
  </svg>;
}

function Gap({ id, g, children, ice }) {
  return <section className={`hx-gap-row hx-wrap${ice ? " hx-ice" : ""}`} aria-labelledby={id}>
    <div className="hx-gap-copy">
      <p className="hx-word" aria-hidden="true">{g.word}</p>
      <h2 id={id}>{g.title}</h2>
      <p className="hx-covers">{g.covers}</p>
      <p className="hx-answer">{g.answer}</p>
      <p className="hx-links">{g.links.map(([text, href]) => <a key={href} className="hx-text" href={href}>{text}</a>)}</p>
    </div>
    {children}
  </section>;
}

/** @param {{spanish?: boolean}} props */
export function HealthStory({ spanish = false }) {
  const t = spanish ? COPY.es : COPY.en;
  return <div className="hx">
    <section className="hx-hero hx-wrap" aria-labelledby="hx-title">
      <p className="hx-label">{t.label}</p>
      <h1 id="hx-title">{t.h1}</h1>
      <p className="hx-promise">{t.promise}</p>
      <ul className="hx-gaps" aria-label={t.gapsLabel}>
        {t.gaps.map((g) => <li key={g.word}>
          <div className="hx-donut-wrap"><Donut pct={g.pct} /><span className="hx-donut-num" aria-hidden="true">{g.pct}%</span></div>
          <div><p className="hx-gap-word">{g.word}</p><p className="hx-gap-line"><span className="hx-sr">{g.pct}% </span>{g.line}</p><p className="hx-src">{g.source}</p></div>
        </li>)}
      </ul>
    </section>

    <Gap ice id="hx-few" g={t.few}><StateGapMap spanish={spanish} /></Gap>

    <Gap id="hx-far" g={t.far}>
      <figure className="hx-hubs">
        <div className="hx-hubs-ends" aria-hidden="true"><span>{t.hubs.ends[0]}</span><span>{t.hubs.ends[1]}</span></div>
        <ol>
          {t.hubs.items.map(([name, when], i) => <li key={name}><span className={`hx-node${i === 2 ? " open" : ""}`} aria-hidden="true" /><strong>{name}</strong><span>{when}</span></li>)}
        </ol>
        <figcaption>{t.hubs.caption}</figcaption>
      </figure>
    </Gap>

    <Gap ice id="hx-hard" g={t.hard}>
      <figure className="hx-venn" aria-label={t.venn.label}>
        <span className="c1" /><span className="c2" /><span className="c3" />
        <em className="l1">{t.venn.parts[0]}</em><em className="l2">{t.venn.parts[1]}</em><em className="l3">{t.venn.parts[2]}</em>
        <strong>Health Access Day</strong>
      </figure>
    </Gap>

    <section className="hx-you hx-wrap" aria-labelledby="hx-you-title">
      <h2 id="hx-you-title" className="hx-label">{t.youTitle}</h2>
      <ul>
        {t.audiences.map((a) => <li key={a.who}><p className="hx-who">{a.who}</p><p className="hx-what">{a.what}</p><a href={a.href}>{a.cta}</a></li>)}
      </ul>
    </section>

    <section className="hx-research hx-wrap" aria-labelledby="hx-research-title">
      <div className="hx-research-head">
        <p className="hx-label">{t.researchLabel}</p>
        <h2 id="hx-research-title">{t.researchTitle}</h2>
        <a className="hx-text" href="/publications">{t.researchLink}</a>
      </div>
      <ul>
        {covers.map((p, i) => <li key={p.title}><a href={p.href} hrefLang={spanish ? "en" : undefined}><img src={p.src} width={p.w} height={p.h} alt={t.cover(p.title)} loading="lazy" decoding="async" /><strong lang={spanish ? "en" : undefined}>{p.title}</strong><span>{t.ideas[i]}</span></a></li>)}
      </ul>
    </section>

  </div>;
}
