import {ArrowDown, ArrowRight} from "@phosphor-icons/react/dist/ssr";

type VoiceAccessFilmProps = {
  locale?: "en" | "es";
};

const content = {
  en: {
    eyebrow: "Voice Access in motion",
    heading: "A conversation that keeps the next step visible.",
    body: "Watch Renata pause, correct the request, interrupt, and review the details before anything is submitted. Voice supports the exchange; the resident stays in control.",
    caption: "Illustrative resident journey. Licensed care and clinical decisions remain with licensed professionals.",
    transcript: "Read the transcript",
    download: "Download the 80-second film",
    aria: "Play the SozoRock Health Voice Access resident journey in English",
    source: "english",
    label: "English · 80 seconds",
  },
  es: {
    eyebrow: "Voice Access en acción",
    heading: "Una conversación que mantiene visible el próximo paso.",
    body: "Mira cómo Renata hace una pausa, corrige la solicitud, interrumpe y revisa los datos antes de enviar. La voz apoya el intercambio; la persona mantiene el control.",
    caption: "Recorrido ilustrativo para residentes. La atención y las decisiones clínicas permanecen con profesionales autorizados.",
    transcript: "Leer la transcripción",
    download: "Descargar el video de 80 segundos",
    aria: "Reproducir el recorrido de Voice Access de SozoRock Health en español",
    source: "spanish",
    label: "Español · 80 segundos",
  },
} as const;

export function VoiceAccessFilm({locale = "en"}: VoiceAccessFilmProps) {
  const copy = content[locale];
  const stem = `/media/voice-access/sozorock-health-voice-access-${copy.source}`;

  return (
    <section className="voice-film" aria-labelledby={`voice-film-heading-${locale}`}>
      <div className="voice-film__intro">
        <div>
          <p className="eyebrow eyebrow--light">{copy.eyebrow}</p>
          <h2 id={`voice-film-heading-${locale}`}>{copy.heading}</h2>
        </div>
        <p>{copy.body}</p>
      </div>

      <figure className="voice-film__figure">
        <div className="voice-film__stage">
          <video
            aria-label={copy.aria}
            aria-describedby={`voice-film-caption-${locale}`}
            controls
            playsInline
            preload="none"
            poster={`${stem}-poster.png`}
            width="1280"
            height="720"
          >
            <source src={`${stem}.mp4`} type="video/mp4" />
            <track
              default
              kind="captions"
              label={locale === "en" ? "English" : "Español"}
              srcLang={locale === "en" ? "en" : "es"}
              src={`${stem}.vtt`}
            />
          </video>
          <span className="voice-film__duration">{copy.label}</span>
        </div>
        <figcaption>
          <p id={`voice-film-caption-${locale}`}>{copy.caption}</p>
          <div className="voice-film__actions">
            <a href={`${stem}-transcript.txt`}>
              {copy.transcript}
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a href={`${stem}.mp4`} download>
              {copy.download}
              <ArrowDown size={17} aria-hidden="true" />
            </a>
          </div>
        </figcaption>
      </figure>
    </section>
  );
}
