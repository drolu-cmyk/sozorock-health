import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PublicationEvent } from "../../../components/PublicationEvent";
import { LogoLockup } from "../../../components/LogoLockup";
import { getPublication } from "../../../lib/publications";
import styles from "../../publications.module.css";

export const metadata: Metadata = {
  title: "Publication ready",
  robots: { index: false, follow: false },
};

export default async function VerifiedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const publication = getPublication((await params).slug);
  if (!publication?.assetKey) notFound();
  const publicationCookies = await cookies();
  if (!publicationCookies.has("__Host-srh_publication_access") && !publicationCookies.has("srh_publication_access"))
    redirect(`/publications/${publication.slug}/access?session=required`);
  return (
    <div className={styles.page}>
      <PublicationEvent event="publication_opened" slug={publication.slug} />
      <header className={styles.header}>
        <LogoLockup />
        <Link href={`/publications/${publication.slug}`}>
          Publication summary
        </Link>
      </header>
      <main className={styles.formWrap}>
        <section className={styles.confirmation}>
          <p className={styles.status}>Email verified</p>
          <h1>{publication.shortTitle} is ready.</h1>
          <p>
            Your secure download link will be created when you select the
            button. It expires after five minutes.
          </p>
          <a
            className={styles.primary}
            href={`/api/publications/download/${publication.slug}`}
          >
            Download publication
          </a>
          <p className={styles.note}>
            For access support, email{" "}
            <a href="mailto:contact@sozorockfoundation.org">
              contact@sozorockfoundation.org
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
