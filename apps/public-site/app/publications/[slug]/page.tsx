import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicationEvent } from "../../components/PublicationEvent";
import { LogoLockup } from "../../components/LogoLockup";
import { getPublication, publications } from "../../lib/publications";
import styles from "../publications.module.css";

export function generateStaticParams() {
  return publications.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const publication = getPublication((await params).slug);
  if (!publication) return {};
  return {
    title: publication.title,
    description: publication.description,
    alternates: { canonical: `/publications/${publication.slug}` },
    openGraph: {
      title: publication.title,
      description: publication.description,
      type: "article",
      images: publication.cover ? [{ url: publication.cover }] : undefined,
    },
  };
}

export default async function PublicationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const publication = getPublication((await params).slug);
  if (!publication) notFound();
  const schema = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: publication.title,
    author: { "@type": "Person", name: "Oluwabiyi Adeyemo" },
    publisher: {
      "@type": "Organization",
      name: "The SozoRock Foundation Inc.",
    },
    about: publication.tags,
    description: publication.description,
  };
  return (
    <div className={styles.page}>
      <PublicationEvent event="publication_viewed" slug={publication.slug} />
      <header className={styles.header}>
        <LogoLockup />
        <Link className={styles.brand} href="/">
          SozoRock<sup>®</sup>
          <span>Health</span>
        </Link>
        <Link href="/#publications">All publications</Link>
      </header>
      <main className={styles.main}>
        <article className={styles.detail}>
          <div className={styles.cover}>
            {publication.cover ? (
              <Image
                src={publication.cover}
                alt={`${publication.title} cover`}
                width={720}
                height={936}
                priority
              />
            ) : (
              <div className={styles.placeholder}>
                <span>Publication series</span>
                <strong>Health Systems Assurance</strong>
                <span>In development</span>
              </div>
            )}
          </div>
          <div>
            <p className={styles.status}>{publication.status}</p>
            <h1>{publication.title}</h1>
            <p className={styles.description}>{publication.description}</p>
            <p className={styles.relevance}>{publication.relevance}</p>
            <ul className={styles.tags} aria-label="Subjects">
              {publication.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            {publication.assetKey ? (
              <>
                <Link
                  className={styles.primary}
                  href={`/publications/${publication.slug}/access`}
                >
                  Access publication
                </Link>
                <p className={styles.note}>
                  Public-interest access is free. Email verification protects
                  the publication and helps us understand who the work serves.
                </p>
              </>
            ) : (
              <>
                <a
                  className={styles.primary}
                  href="mailto:contact@sozorockfoundation.org?subject=Health%20Systems%20Assurance%20publication%20updates"
                >
                  Ask about the series
                </a>
                <p className={styles.note}>
                  This series is in development. No release date has been
                  announced.
                </p>
              </>
            )}
          </div>
        </article>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </div>
  );
}
