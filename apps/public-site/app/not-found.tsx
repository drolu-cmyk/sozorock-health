import { HealthShell } from "./components/HealthShell";
import { healthMetadata } from "./lib/health-metadata";
export const metadata = {
  ...healthMetadata(
    "Page not found",
    "This page is not available. Return to SozoRock Health or explore our work.",
    "/",
    { noindex: true },
  ),
  alternates: { canonical: null },
};
export default function NotFound() {
  return (
    <HealthShell>
      <main id="health-main" className="hs-error">
        <p className="hs-eyebrow">Page not found</p>
        <h1>Let’s find a useful starting point.</h1>
        <p>
          The address may have changed, or the page may no longer be available.
        </p>
        <div className="hs-actions">
          <a className="hs-primary" href="/">
            Return to Health
          </a>
          <a className="hs-link" href="/work">
            Explore our work
          </a>
        </div>
      </main>
    </HealthShell>
  );
}
