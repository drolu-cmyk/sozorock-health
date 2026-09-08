import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HealthShell } from "../../components/HealthShell";
import styles from "../publications.module.css";

export const metadata: Metadata = {
  title: "Confirm publication access",
  robots: { index: false, follow: false },
  // The bearer is already in an HttpOnly cookie. Keep cross-site referrers
  // suppressed while allowing native form POSTs to carry their real Origin.
  referrer: "same-origin",
};

export default async function ConfirmPublicationAccess({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token?.slice(0, 160) ?? "";

  // Preserve compatibility with verification emails issued before the token
  // handoff route changed, while immediately moving the bearer out of the page URL.
  if (token) {
    redirect(`/api/publications/verify?token=${encodeURIComponent(token)}`);
  }

  const publicationCookies = await cookies();
  const production = process.env.NODE_ENV === "production";
  const hasVerification = publicationCookies.has(
    production ? "__Host-srh_publication_verify" : "srh_publication_verify",
  );

  return (
    <HealthShell>
      <div className={styles.page}>
        <main id="health-main" className={styles.formWrap}>
          <section className={styles.confirmation}>
            <p className={styles.status}>Publication access</p>
            <h1>Confirm your email address.</h1>
            {hasVerification ? (
              <>
                <p>
                  Confirm your email to open the publication download.
                </p>
                <form action="/api/publications/verify" method="post">
                  <button className={styles.primary} type="submit">
                    Confirm email and continue
                  </button>
                </form>
              </>
            ) : (
              <>
                <p role="alert">
                  This verification link is incomplete or no longer active.
                </p>
                <Link href="/publications">Return to publications</Link>
              </>
            )}
          </section>
        </main>
      </div>
    </HealthShell>
  );
}
