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
  const base = healthMetadata(`${publication.plainTitle}, Volume 1`, `${publication.takeaway} ${publication.listFinding} By Dr. Oluwabiyi Adeyemo.`, path);
  const code = publication.slug.startsWith("rural")
    ? "rebs"
    : publication.slug.startsWith("rethinking")
      ? "rrg"
      : "hsa";
  const image = {
    url: `/social/${code}-social-card.png`,
    width: 1200,
    height: 630,
    alt: `${publication.title} by Dr. Oluwabiyi Adeyemo`,
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
      name: publication.author ?? "Dr. Oluwabiyi Adeyemo",
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
      <PublicationEvent event="publication_viewed" slug={publication.slug} />
      <main id="health-main" className="hx">
        <section className="hx-report-hero hx-wrap" aria-labelledby="hx-title">
          <div>
            <p className="hx-label">{publication.published} · Volume 1</p>
            <h1 id="hx-title">{publication.plainTitle}</h1>
            <p className="hx-promise">{publication.takeaway}</p>
            <p className="hx-report-byline">
              {publication.author ?? "Dr. Oluwabiyi Adeyemo"} · The SozoRock Foundation
              {publication.doi ? <> · DOI <a href={`https://doi.org/${publication.doi}`}>{publication.doi}</a></> : null}
              {publication.isbn ? <> · ISBN {publication.isbn}</> : null}
            </p>
            {publication.assetKey ? <p className="hx-links hx-cta-row"><Link className="hx-pill" href={`/publications/${publication.slug}/access`}>Read the full report</Link></p> : null}
          </div>
          {publication.cover ? (
            <Image
              src={publication.previewCover ?? publication.cover}
              alt={`${publication.plainTitle} cover`}
              width={publication.previewWidth}
              height={publication.previewHeight}
              sizes="(max-width: 900px) 70vw, 380px"
              priority
            />
          ) : null}
        </section>

        <section className="hx-findings hx-wrap hx-ice" aria-labelledby="hx-found-title">
          <h2 id="hx-found-title" className="hx-label">What the report found</h2>
          <ul>
            {publication.findings.map((finding) => (
              <li key={finding.value}>
                <strong className={finding.value.length > 8 ? "is-word" : undefined}>{finding.value}</strong>
                <p>{finding.text}</p>
              </li>
            ))}
          </ul>
          <p className="hx-src">{publication.findingsSource}</p>
        </section>

        <section className="hx-ideas hx-wrap" aria-labelledby="hx-ideas-title">
          <div>
            <p className="hx-label">What it means</p>
            <h2 id="hx-ideas-title">{publication.ideasTitle}</h2>
          </div>
          <ol>
            {publication.ideas.map((idea) => <li key={idea}>{idea}</li>)}
          </ol>
        </section>

        {publication.assetKey ? (
          <section className="hx-access hx-wrap" aria-labelledby="hx-access-title">
            <div>
              <h2 id="hx-access-title">Read the full report, free.</h2>
              <p>Enter your email and we will send a secure link. Updates are optional.</p>
            </div>
            <Link className="hx-pill hx-pill-light" href={`/publications/${publication.slug}/access`}>Request the full report</Link>
          </section>
        ) : null}

        <p className="hx-wrap hx-fine-print">
          {publication.limitations ? <>{publication.limitations} </> : null}
          For reuse, permissions or corrections, write to <a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a>.
        </p>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </main>
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
