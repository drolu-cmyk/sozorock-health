"use client";
import { HealthShell } from "./components/HealthShell";
export default function HealthError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <HealthShell>
      <main id="health-main" className="hs-error">
        <p className="hs-eyebrow">Page unavailable</p>
        <h1>We couldn’t load this page.</h1>
        <p>
          Please try again. If the problem continues, contact the Foundation.
        </p>
        <div className="hs-actions">
          <button className="hs-primary" onClick={reset}>
            Try again
          </button>
          <a className="hs-link" href="/">
            Return to Health
          </a>
        </div>
      </main>
    </HealthShell>
  );
}
