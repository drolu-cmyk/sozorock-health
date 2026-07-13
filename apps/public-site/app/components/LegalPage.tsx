import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { LogoLockup } from "./LogoLockup";

export function LegalPage({ eyebrow, title, titleSize = "standard", updated, children }: { eyebrow: string; title: string; titleSize?: "standard" | "compact"; updated: string; children: React.ReactNode }) {
  return (
    <div className="legal-page">
      <a className="skip-link" href="#legal-content">Skip to content</a>
      <header className="legal-header">
        <LogoLockup />
        <a href="/"><ArrowLeft size={16} aria-hidden="true" />Return home</a>
      </header>
      <main id="legal-content">
        <article>
          <p className="section-label">{eyebrow}</p>
          <h1 className={titleSize === "compact" ? "legal-title--compact" : undefined}>{title}</h1>
          <p className="legal-updated">Last updated <time dateTime="2026-07-11">{updated}</time></p>
          {children}
          <aside aria-labelledby="legal-contact-heading">
            <strong id="legal-contact-heading">Questions or accommodation requests</strong>
            <a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a>
          </aside>
        </article>
      </main>
    </div>
  );
}
