import { CountyHealthMap } from "./CountyHealthMap";

const sponsorUrl = "https://www.sozorockfoundation.org/support";
const neighborValues = [["New Jersey", "Nueva Jersey", 83.22], ["Vermont", "Vermont", 82.64], ["Connecticut", "Connecticut", 60], ["Massachusetts", "Massachusetts", 58.72], ["Pennsylvania", "Pensilvania", 55.47], ["United States", "Estados Unidos", 46.75], ["New York", "Nueva York", 35.42]];
const tierValues = [["Community", "Comunidad", 5000], ["Access", "Acceso", 10000], ["Principal", "Principal", 25000], ["Lead", "Líder", 50000]];

const COPY = {
  en: {
    eyebrow: "Primary Care Access Program",
    h1: "A sponsored year of primary care.",
    lead: "For up to 25 New Yorkers living with a chronic condition, starting January 2027. All care is delivered by licensed providers.",
    join: "Join the interest list", sponsor: "Sponsor a participant", becomeSponsor: "Become a sponsor",
    kpiLabel: "Key figures",
    kpis: [["5.29M", "New Yorkers live in designated primary-care shortage areas.", "HRSA · Sep 30, 2026"], ["1,130", "more primary-care physicians needed to remove those designations.", "HRSA · Sep 30, 2026"], ["1.8M", "adults in New York are estimated to live with diagnosed diabetes.", "SozoRock estimate · CDC PLACES 2025, 2023 data"]],
    regionTitle: "New York meets the smallest share of primary-care need in its region.",
    regionLead: "In shortage areas, New York has about a third of the primary-care physicians needed. New Jersey and Vermont have more than four-fifths.",
    regionNote: "Percent of need met compares available primary-care physicians with the number needed to remove a shortage designation. It is not the share of people receiving care. Same-date snapshot; not a trend.",
    chartCaption: "Primary-care need met in New York, its five neighboring states and the United States, on a 0–100% scale.",
    source: <>Source: <a href="/sources/hrsa-september-2026.pdf">HRSA, Designated HPSA Quarterly Summary, FY2026 Q4, Table 3</a> (as of September 30, 2026). National total includes New York. <a href="/evidence#methods">Sources and methods</a>.</>,
    programTitle: "One clear route to a doctor who knows you.",
    programLead: "The Primary Care Access Program sponsors a direct primary care membership with Dr. Michael Purcell and Purcell Integrative Osteopathic Care, a direct primary care practice in Clifton Park, plus the support that makes care usable.",
    programNote: "Clinical care stays with the licensed provider. Membership is not health insurance. Part of the SozoRock Health Equity Initiative.",
    supports: [["Direct primary care", "A sponsored membership for 12 months."], ["Ongoing telehealth", "Care between visits, from home."], ["Transportation help", "Support getting to appointments."], ["Health access education", "Using care, coverage and tools well."]],
    whoTitle: "Who can join the first cohort",
    who: [["Up to 25", "New Yorkers, one per household"], ["64 or younger", "with financial need"], ["Chronic", "condition, such as diabetes or high blood pressure"], ["62 counties", "open to residents statewide"]],
    yearTitle: "How the year works",
    steps: [["Now", "Join the interest list"], ["Before enrollment", "Eligibility review; sponsor funds confirmed"], ["January 2027", "Membership and support begin"], ["Months 3, 6, 9", "Progress reports to sponsors"], ["Month 12", "Year-end report; sponsor renewal optional"]],
    yearNote: "A small first cohort shows where the pathway works, where it fails and what should change before expansion.",
    sponsorTitle: "supports one New Yorker for a full year.",
    sponsorText: "First-cohort budget: $108,000. Funds are confirmed before anyone enrolls. Sponsors receive reports at months 3, 6, 9 and 12, and do not select participants or influence clinical care. Sponsor renewal is optional.",
    covers: (n) => `Covers ${n} participant-year${n > 1 ? "s" : ""}`,
    tierNote: "Other amounts are welcome. Participant-years calculated at $4,320 each, rounded down.",
    hubsTitle: "Health Equity Hubs: a private place to reach care, close to home.",
    hubs: [["By appointment", "Library hubs", "A private room, a device and secure Wi‑Fi in a public library, reserved when space is available."], ["At scheduled events", "Community hubs", "The same private setup, brought to community spaces."], ["In development", "Home hubs", "Support to use a provider’s platform from home. Not a clinical service."]],
    hubsNote: <>Each visit runs on the provider’s own platform, and the record stays with the provider. <a href="/work">Our work</a> also includes Health Access Day.</>,
    closeTitle: "Could this year of care be for you, or someone you know?",
    closeText: "Join the interest list by email or phone. No health details needed.",
    footSources: <>Sources: HRSA Designated HPSA Quarterly Summary, FY2026 Q4, Table 3. CDC PLACES County Data, 2025 release (dataset i46a-9kgh). <a href="/evidence#methods">Full methods and downloadable data</a>.</>,
    chart: { caption: "Primary-care need met in shortage areas", note: "HRSA, designated primary-care HPSAs, as of September 30, 2026. A workforce measure, not appointment access." },
    film: { title: "Care for every ZIP Code.", label: "Care for every ZIP Code, a 47-second introduction to SozoRock Health", transcript: "Read the descriptive transcript", transcriptHref: "/media/care-for-every-zip-code.transcript.txt", note: null },
    money: (n) => `$${n.toLocaleString("en-US")}`,
  },
  es: {
    eyebrow: "Programa de Acceso a la Atención Primaria",
    h1: "Un año de atención primaria patrocinada.",
    lead: "Para hasta 25 personas en Nueva York que viven con una enfermedad crónica, a partir de enero de 2027. Toda la atención la brindan proveedores con licencia.",
    join: "Únase a la lista de interés", sponsor: "Patrocine a un participante", becomeSponsor: "Hágase patrocinador",
    kpiLabel: "Cifras clave",
    kpis: [["5.29 M", "de personas en Nueva York viven en zonas designadas con escasez de atención primaria.", "HRSA · 30 sep. 2026"], ["1,130", "médicos de atención primaria adicionales harían falta para eliminar esas designaciones.", "HRSA · 30 sep. 2026"], ["1.8 M", "de adultos en Nueva York viven con diabetes diagnosticada, según las estimaciones.", "Estimación de SozoRock · CDC PLACES 2025, datos de 2023"]],
    regionTitle: "Nueva York cubre la menor parte de la necesidad de atención primaria de su región.",
    regionLead: "En las zonas con escasez, Nueva York tiene cerca de un tercio de los médicos de atención primaria que se necesitan. Nueva Jersey y Vermont tienen más de cuatro quintos.",
    regionNote: "El porcentaje de necesidad cubierta compara los médicos de atención primaria disponibles con los que se necesitan para eliminar una designación de escasez. No es el porcentaje de personas que reciben atención. Es una foto en una misma fecha, no una tendencia.",
    chartCaption: "Necesidad de atención primaria cubierta en Nueva York, sus cinco estados vecinos y Estados Unidos, en una escala de 0 a 100%.",
    source: <>Fuente: <a href="/sources/hrsa-september-2026.pdf" hrefLang="en">HRSA, Designated HPSA Quarterly Summary, cuarto trimestre del año fiscal 2026, tabla 3</a> (al 30 de septiembre de 2026). El total nacional incluye a Nueva York. <a href="/evidence#methods" hrefLang="en">Fuentes y métodos (en inglés)</a>.</>,
    programTitle: "Un camino claro hacia un médico que lo conozca.",
    programLead: "El Programa de Acceso a la Atención Primaria patrocina una membresía de atención primaria directa con el Dr. Michael Purcell y Purcell Integrative Osteopathic Care, una práctica de atención primaria directa en Clifton Park, además del apoyo que hace que la atención sea fácil de usar.",
    programNote: "La atención clínica queda a cargo del proveedor con licencia. La membresía no es un seguro médico. Forma parte de la Health Equity Initiative de SozoRock.",
    supports: [["Atención primaria directa", "Una membresía patrocinada durante 12 meses."], ["Telesalud continua", "Atención entre consultas, desde casa."], ["Ayuda con el transporte", "Apoyo para llegar a las citas."], ["Educación sobre el acceso a la salud", "Cómo aprovechar bien la atención, la cobertura y las herramientas."]],
    whoTitle: "Quién puede formar parte del primer grupo",
    who: [["Hasta 25", "personas en Nueva York, una por hogar"], ["64 años o menos", "con necesidad económica"], ["Enfermedad crónica", "como diabetes o presión arterial alta"], ["62 condados", "abierto a residentes de todo el estado"]],
    yearTitle: "Cómo funciona el año",
    steps: [["Ahora", "Únase a la lista de interés"], ["Antes de la inscripción", "Revisión de requisitos; fondos de patrocinio confirmados"], ["Enero de 2027", "Comienzan la membresía y el apoyo"], ["Meses 3, 6 y 9", "Informes de avance para los patrocinadores"], ["Mes 12", "Informe de fin de año; renovación del patrocinio opcional"]],
    yearNote: "Un primer grupo pequeño muestra dónde funciona el camino, dónde falla y qué debe cambiar antes de crecer.",
    sponsorTitle: "cubren a una persona en Nueva York durante un año completo.",
    sponsorText: "Presupuesto del primer grupo: $108,000. Los fondos se confirman antes de que alguien se inscriba. Los patrocinadores reciben informes a los 3, 6, 9 y 12 meses, y no eligen a los participantes ni influyen en la atención clínica. La renovación del patrocinio es opcional.",
    covers: (n) => `Cubre ${n} ${n > 1 ? "años-participante" : "año-participante"}`,
    tierNote: "Se aceptan otros montos. Años-participante calculados a $4,320 cada uno, redondeados hacia abajo.",
    hubsTitle: "Health Equity Hubs: un lugar privado para acceder a la atención, cerca de casa.",
    hubs: [["Con cita previa", "Hubs en bibliotecas", "Una sala privada, un dispositivo y wifi seguro en una biblioteca pública, reservados cuando hay espacio disponible."], ["En eventos programados", "Hubs comunitarios", "La misma instalación privada, en espacios comunitarios."], ["En desarrollo", "Hubs en el hogar", "Apoyo para usar la plataforma del proveedor desde casa. No es un servicio clínico."]],
    hubsNote: <>Cada consulta se realiza en la plataforma del propio proveedor, y el expediente queda con el proveedor. <a href="/work" hrefLang="en">Nuestro trabajo</a> (en inglés) también incluye Health Access Day.</>,
    closeTitle: "¿Podría este año de atención ser para usted o para alguien que conoce?",
    closeText: "Únase a la lista de interés por correo electrónico o por teléfono. No necesita dar datos de salud. El formulario está en inglés; si necesita ayuda en español, escriba a contact@sozorockfoundation.org.",
    footSources: <>Fuentes: HRSA Designated HPSA Quarterly Summary, cuarto trimestre del año fiscal 2026, tabla 3. CDC PLACES, datos por condado, edición de 2025 (conjunto de datos i46a-9kgh). <a href="/evidence#methods" hrefLang="en">Métodos completos y datos para descargar (en inglés)</a>.</>,
    chart: { caption: "Necesidad de atención primaria cubierta en zonas con escasez", note: "HRSA, zonas designadas con escasez de atención primaria, al 30 de septiembre de 2026. Mide la fuerza laboral, no la disponibilidad de citas." },
    film: { title: "Atención médica para cada código postal.", label: "Atención médica para cada código postal, una presentación de 47 segundos de SozoRock Health", transcript: "Lea la transcripción descriptiva", transcriptHref: "/media/care-for-every-zip-code.transcript.es.txt", note: "El video tiene música y no tiene narración. Su texto en pantalla está en inglés; los subtítulos en español lo traducen." },
    money: (n) => `$${n.toLocaleString("en-US")}`,
  },
};

function Actions({ t }) { return <div className="hc-actions"><a className="hc-btn hc-primary" href="/interest">{t.join}</a><a className="hc-btn hc-ghost" href={sponsorUrl}>{t.sponsor}</a></div>; }

/** @param {{spanish?: boolean}} props */
export function PrimaryCareAccessPage({ spanish = false }) {
  const t = spanish ? COPY.es : COPY.en;
  const neighbors = neighborValues.map(([en, es, value]) => [spanish ? es : en, value, en]);
  return <div className="hc-home">
    <section className="hc-section hc-opening"><div className="hc-wrap hc-hero"><div><p className="hc-eyebrow">{t.eyebrow}</p><h1>{t.h1}</h1><p className="hc-hero-lead">{t.lead}</p><Actions t={t} /></div>
      <PrimaryCareNeedChart spanish={spanish} />
    </div></section>
    <section className="hc-kpi-band" aria-label={t.kpiLabel}><div className="hc-wrap hc-kpis">{t.kpis.map(([number, text, source]) => <div className="hc-kpi" key={number}><strong>{number}</strong><p>{text}</p><p className="hc-note">{source}</p></div>)}</div></section>
    <section className="hc-section" id="evidence"><div className="hc-wrap hc-split"><div><h2>{t.regionTitle}</h2><p className="hc-lead">{t.regionLead}</p><p className="hc-note">{t.regionNote}</p></div>
      <figure className="hc-neighbor-chart"><figcaption className="sr-only">{t.chartCaption}</figcaption><div className="hc-ranked-bars">{neighbors.map(([name, value, key]) => <div className={`hc-ranked-row ${key === "New York" ? "hc-new-york" : key === "United States" ? "hc-national" : ""}`} key={key}><span>{name}</span><div className="hc-ranked-track"><span style={{ width: `${value}%` }} /></div><strong>{value.toFixed(1)}%</strong></div>)}</div><div className="hc-ranked-axis" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div><p className="hc-note">{t.source}</p></figure>
    </div></section>
    <CountyHealthMap spanish={spanish} />
    <section className="hc-section" id="program"><div className="hc-wrap"><div className="hc-split"><div><h2>{t.programTitle}</h2><p className="hc-lead">{t.programLead}</p><p className="hc-note">{t.programNote}</p></div><div className="hc-supports">{t.supports.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></div>
      <div className="hc-eligibility"><h3>{t.whoTitle}</h3><div>{t.who.map(([title, text]) => <div key={title}><strong>{title}</strong><p>{text}</p></div>)}</div></div>
      <div className="hc-year"><h3>{t.yearTitle}</h3><ol>{t.steps.map(([when, text], i) => <li key={when} className={i === 2 ? "hc-start" : ""}><strong>{when}</strong><p>{text}</p></li>)}</ol><p className="hc-note">{t.yearNote}</p></div>
    </div></section>
    <PrimaryCareFilm spanish={spanish} />
    <section className="hc-section hc-sponsor" id="sponsor"><div className="hc-wrap hc-split"><div><h2><span>$4,320</span>{t.sponsorTitle}</h2><p>{t.sponsorText}</p><a className="hc-btn" href={sponsorUrl}>{t.becomeSponsor}</a></div><div className="hc-tiers">{tierValues.map(([en, es, amount]) => {const count = Math.floor(amount / 4320);return <article key={en}><h3>{spanish ? es : en}</h3><strong>{t.money(amount)}</strong><div className="hc-participant-dots" aria-hidden="true">{Array.from({ length: count }, (_, i) => <span key={i} />)}</div><p>{t.covers(count)}</p></article>;})}<p className="hc-tier-note">{t.tierNote}</p></div></div></section>
    <section className="hc-section"><div className="hc-wrap"><h2>{t.hubsTitle}</h2><div className="hc-hubs">{t.hubs.map(([status, name, text]) => <article key={name}><span>{status}</span><h3>{name}</h3><p>{text}</p></article>)}</div><p className="hc-note hc-more-work">{t.hubsNote}</p></div></section>
    <section className="hc-section hc-closing"><div className="hc-wrap"><div><h2>{t.closeTitle}</h2><p>{t.closeText}</p></div><Actions t={t} /></div></section>
    <div className="hc-wrap hc-source-footer"><p className="hc-note">{t.footSources}</p></div>
  </div>;
}

/** @param {{spanish?: boolean}} props */
export function PrimaryCareNeedChart({ spanish = false }) {
  const t = spanish ? COPY.es : COPY.en;
  return <figure className="hc-hero-chart"><figcaption>{t.chart.caption}</figcaption><div className="hc-mini-bars">{[["United States", "Estados Unidos", 46.75], ["New York", "Nueva York", 35.42]].map(([en, es, value]) => <div className={en === "New York" ? "hc-mini-row hc-new-york" : "hc-mini-row"} key={en}><div><span>{spanish ? es : en}</span><strong>{value.toFixed(2)}%</strong></div><div className="hc-mini-track"><span style={{ width: `${value}%` }} /></div></div>)}</div><div className="hc-axis"><span>0%</span><span>50%</span><span>100%</span></div><p className="hc-note">{t.chart.note}</p></figure>;
}

/** @param {{spanish?: boolean}} props */
export function PrimaryCareFilm({ spanish = false }) {
  const f = (spanish ? COPY.es : COPY.en).film;
  return <section className="hc-film" aria-labelledby="care-film-title"><div className="hc-wrap"><h2 id="care-film-title">{f.title}</h2><video controls playsInline preload="none" width="1920" height="1080" poster="/media/care-for-every-zip-code.poster.jpg" aria-label={f.label}><source src="/media/sozorock-health-care-for-every-zip-code.mp4" type="video/mp4" />{spanish ? <><track kind="subtitles" src="/media/care-for-every-zip-code.es.vtt" srcLang="es" label="Español" default /><track kind="descriptions" src="/media/care-for-every-zip-code.visual.es.vtt" srcLang="es" label="Descripción visual en español" /></> : <><track kind="captions" src="/media/care-for-every-zip-code.en.vtt" srcLang="en" label="English" /><track kind="descriptions" src="/media/care-for-every-zip-code.visual.en.vtt" srcLang="en" label="English visual description" /></>}</video>{f.note && <p className="hc-note">{f.note}</p>}<p className="hc-note"><a href={f.transcriptHref}>{f.transcript}</a></p></div></section>;
}
