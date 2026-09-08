import type { Metadata } from "next";
import {
  healthMetadata,
  foundationEntity,
  healthOrigin,
  healthPageSchema,
} from "../../lib/health-metadata";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicationEvent } from "../../components/PublicationEvent";
import { HealthShell } from "../../components/HealthShell";
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
  const path = `/publications/${publication.slug}`;
  const base = healthMetadata(publication.title, publication.description, path);
  const code = publication.slug.startsWith("rural")
    ? "rebs"
    : publication.slug.startsWith("rethinking")
      ? "rrg"
      : "hsa";
  const image = {
    url: `/social/${code}-social-card.png`,
    width: 1200,
    height: 630,
    alt: `${publication.title} by Oluwabiyi Adeyemo`,
  };
  return {
    ...base,
    openGraph: { ...base.openGraph, type: "article", images: [image] },
    twitter: { ...base.twitter, images: [image.url] },
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
    "@id": `${healthOrigin}/publications/${publication.slug}#publication`,
    url: `${healthOrigin}/publications/${publication.slug}`,
    name: publication.title,
    author: {
      "@type": "Person",
      name: publication.author ?? "Oluwabiyi Adeyemo",
    },
    publisher: {
      "@type": "Organization",
      "@id": foundationEntity,
      name: publication.publisher ?? "The SozoRock Foundation, Inc.",
    },
    about: publication.tags,
    description: publication.description,
    datePublished: publication.datePublished,
    bookEdition: publication.edition,
    isbn: publication.isbn,
    ...(publication.doi
      ? {
          identifier: {
            "@type": "PropertyValue",
            propertyID: "DOI",
            value: publication.doi,
          },
          sameAs: `https://doi.org/${publication.doi}`,
        }
      : {}),
  };
  return (
    <HealthShell>
      <div className={styles.page}>
        <PublicationEvent event="publication_viewed" slug={publication.slug} />
        <main id="health-main" className={styles.main}>
          <article className={styles.detail}>
            <div className={styles.cover}>
              {publication.cover ? (
                <Image
                  src={publication.previewCover ?? publication.cover}
                  alt={`${publication.title} cover`}
                  width={publication.coverWidth ?? 2550}
                  height={publication.coverHeight ?? 3300}
                  quality={95}
                  sizes="(max-width: 700px) 78vw, 360px"
                  priority
                />
              ) : (
                <div className={styles.placeholder}>
                  <span>Publication series</span>
                  <strong>Health Systems Assurance</strong>
                </div>
              )}
            </div>
            <div>
              <p className={styles.status}>{publication.status}</p>
              <h1>{publication.title}</h1>
              <p className={styles.description}>{publication.description}</p>
              <p className={styles.relevance}>{publication.relevance}</p>
              {publication.published || publication.isbn || publication.doi ? (
                <dl className={styles.facts}>
                  {publication.author ? (
                    <div>
                      <dt>Author</dt>
                      <dd>{publication.author}</dd>
                    </div>
                  ) : null}
                  {publication.publisher ? (
                    <div>
                      <dt>Publisher</dt>
                      <dd>{publication.publisher}</dd>
                    </div>
                  ) : null}
                  {publication.published ? (
                    <div>
                      <dt>Published</dt>
                      <dd>{publication.published}</dd>
                    </div>
                  ) : null}
                  {publication.edition ? (
                    <div>
                      <dt>Edition</dt>
                      <dd>{publication.edition}</dd>
                    </div>
                  ) : null}
                  {publication.doi ? (
                    <div>
                      <dt>DOI</dt>
                      <dd>
                        <a href={`https://doi.org/${publication.doi}`}>
                          {publication.doi}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {publication.isbn ? (
                    <div>
                      <dt>ISBN</dt>
                      <dd>{publication.isbn}</dd>
                    </div>
                  ) : null}
                  {publication.evidenceCutoff ? (
                    <div>
                      <dt>Evidence cutoff</dt>
                      <dd>{publication.evidenceCutoff}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
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
                    Public-interest access is free. Complete the short access
                    form and confirm your email address to receive a secure,
                    time-limited download.
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            healthPageSchema(
              publication.title,
              `/publications/${publication.slug}`,
            ),
          ),
        }}
      />
    </HealthShell>
  );
}
