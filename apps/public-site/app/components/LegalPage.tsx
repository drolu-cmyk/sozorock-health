import { HealthShell } from "./HealthShell";
import { healthPageSchema } from "../lib/health-metadata";
const paths: Record<string, string> = {
  "Privacy notice": "/privacy",
  "Terms of use": "/terms",
  Accessibility: "/accessibility",
  Nondiscrimination: "/nondiscrimination",
  "Nondiscrimination notice": "/nondiscrimination",
};
export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  titleSize?: "standard" | "compact";
  updated: string;
  children: React.ReactNode;
}) {
  const parsed = new Date(updated);
  const isoDate = Number.isNaN(parsed.valueOf())
    ? undefined
    : parsed.toISOString().slice(0, 10);
  return (
    <HealthShell>
      <main id="health-main" className="hs-legal">
        <article>
          <p className="hs-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="hs-updated">
            Last updated <time dateTime={isoDate}>{updated}</time>
          </p>
          {children}
          <aside>
            <strong>Questions or accommodation requests</strong>
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
            __html: JSON.stringify(healthPageSchema(title, paths[title])),
          }}
        />
      ) : null}
    </HealthShell>
  );
}
