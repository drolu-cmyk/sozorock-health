import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicationAccessForm } from "../../../components/PublicationAccessForm";
import { PublicationEvent } from "../../../components/PublicationEvent";
import { LogoLockup } from "../../../components/LogoLockup";
import { getPublication } from "../../../lib/publications";
import styles from "../../publications.module.css";

export const metadata: Metadata = {
  title: "Publication access",
  robots: { index: false, follow: false },
};

export default async function AccessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const publication = getPublication((await params).slug);
  if (!publication?.assetKey) notFound();
  return (
    <div className={styles.page}>
      <PublicationEvent event="access_started" slug={publication.slug} />
      <header className={styles.header}>
        <LogoLockup />
        <Link className={styles.brand} href="/">
          SozoRock<sup>®</sup>
          <span>Health</span>
        </Link>
        <Link href={`/publications/${publication.slug}`}>
          Return to summary
        </Link>
      </header>
      <main className={styles.formWrap}>
        <PublicationAccessForm
          slug={publication.slug}
          title={publication.shortTitle}
        />
      </main>
    </div>
  );
}
