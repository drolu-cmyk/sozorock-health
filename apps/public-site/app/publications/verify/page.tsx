import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoLockup } from "../../components/LogoLockup";
import styles from "../publications.module.css";

export const metadata: Metadata = {
  title: "Confirm publication access",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
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
    <div className={styles.page}>
      <header className={styles.header}>
        <LogoLockup />
        <Link href="/publications">All publications</Link>
      </header>
      <main className={styles.formWrap}>
        <section className={styles.confirmation}>
          <p className={styles.status}>Email verification</p>
          <h1>Confirm access to your publication.</h1>
          {hasVerification ? (
            <>
              <p>Select continue to confirm your email and open the publication.</p>
              <form action="/api/publications/verify" method="post">
                <button className={styles.primary} type="submit">
                  Continue to publication
                </button>
              </form>
            </>
          ) : (
            <>
              <p role="alert">This verification link is incomplete or no longer active.</p>
              <Link href="/publications">Request a new link</Link>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
