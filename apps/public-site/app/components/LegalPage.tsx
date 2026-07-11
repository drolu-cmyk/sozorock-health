import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: React.ReactNode }) {
  return <main className="legal-page"><a className="skip-link" href="#legal-content">Skip to content</a><header className="legal-header"><a href="/" className="brand-lockup" aria-label="SozoRock Health home"><span className="wordmark-image"><img src="/brand/sozorock-wordmark-clean-v2.png" alt="SozoRock"/><sup aria-label="registered trademark">®</sup></span><span>HEALTH</span></a><a href="/"><ArrowLeft size={16} aria-hidden="true"/>Return home</a></header><article id="legal-content"><p className="section-label">{eyebrow}</p><h1>{title}</h1><p className="legal-updated">Last updated {updated}</p>{children}<aside><strong>Questions or accommodation requests</strong><a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a></aside></article></main>;
}
