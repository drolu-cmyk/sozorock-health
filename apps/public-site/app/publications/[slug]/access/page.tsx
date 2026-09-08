import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicationAccessForm } from "../../../components/PublicationAccessForm";
import { PublicationEvent } from "../../../components/PublicationEvent";
import { HealthShell } from "../../../components/HealthShell";
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
    <HealthShell>
      <div className={styles.page}>
        <PublicationEvent event="access_started" slug={publication.slug} />
        <main id="health-main" className={styles.formWrap}>
          <PublicationAccessForm
            slug={publication.slug}
            title={publication.shortTitle}
          />
        </main>
      </div>
    </HealthShell>
  );
}
