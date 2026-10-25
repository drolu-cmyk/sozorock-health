import { HealthShell } from "./HealthShell";
import { healthPageSchema } from "../lib/health-metadata";
const paths: Record<string, string> = {
  "Privacy notice": "/privacy",
  "Terms of use": "/terms",
  Accessibility: "/accessibility",
  Nondiscrimination: "/nondiscrimination",
  "Nondiscrimination notice": "/nondiscrimination",
  "Aviso de privacidad": "/es/privacy",
  "Condiciones de uso": "/es/terms",
  Accesibilidad: "/es/accessibility",
  "No discriminación": "/es/nondiscrimination",
};
function legalSchema(title: string, path: string, spanish: boolean) {
  const schema = healthPageSchema(title, path);
  if (!spanish) return schema;
  return { ...schema, "@graph": schema["@graph"].map((node, index) => (index === 0 ? { ...node, inLanguage: "es-US" } : node)) };
}

export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
  spanish = false,
  path,
}: {
  eyebrow?: string;
  title: string;
  titleSize?: "standard" | "compact";
  updated: string;
  children: React.ReactNode;
  spanish?: boolean;
  path?: string;
}) {
  const parsed = new Date(updated);
  const isoDate = Number.isNaN(parsed.valueOf())
    ? undefined
    : parsed.toISOString().slice(0, 10);
  return (
    <HealthShell spanish={spanish} path={path ?? paths[title]}>
      <main id="health-main" className="hs-legal">
        <article>
          {eyebrow ? <p className="hs-eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          <p className="hs-updated">
            {spanish ? "Última actualización:" : "Last updated"} <time dateTime={isoDate}>{updated}</time>
          </p>
          {spanish ? (
            <p className="hs-translation-note">
              Esta es una traducción de la versión en inglés. Si hay alguna
              diferencia, prevalece la{" "}
              <a href={(path ?? paths[title] ?? "/es").replace(/^\/es/, "") || "/"} hrefLang="en" lang="en">
                versión en inglés
              </a>
              .
            </p>
          ) : null}
          {children}
          <aside>
            <strong>{spanish ? "Preguntas o solicitudes de adaptaciones" : "Questions or accommodation requests"}</strong>
            <a href="mailto:contact@sozorockfoundation.org">
              contact@sozorockfoundation.org
            </a>
          </aside>
        </article>
      </main>
      {paths[title] ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(legalSchema(title, paths[title], spanish)),
          }}
        />
      ) : null}
    </HealthShell>
  );
}
