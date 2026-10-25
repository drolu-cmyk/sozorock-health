export const dynamic = "force-dynamic";
export const revalidate = 0;

import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
import Image from "next/image";
import Link from "next/link";
import { HealthShell } from "../components/HealthShell";
import { publications } from "../lib/publications";

export const metadata = healthMetadata(
  "Research",
  "Three reports by Dr. Oluwabiyi Adeyemo on rural health access, county planning and trustworthy digital health, with key findings and free access.",
  "/publications",
);

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ verification?: string }>;
}) {
  const verification = (await searchParams).verification;
  return (
    <HealthShell>
      <main id="health-main" className="hx">
        <section className="hx-research-hero hx-wrap" aria-labelledby="hx-title">
          <div>
            <h1 id="hx-title">What it takes for care to reach every county.</h1>
          </div>
          <p className="hx-answer">Three reports by Dr. Oluwabiyi Adeyemo on rural access, county planning and trustworthy digital health. Free to read.</p>
        </section>
        {verification ? (
          <p className="hx-wrap hx-alert" role="alert">
            {verification === "expired"
              ? "That verification link has expired or was already used. Return to the report and request a new link."
              : verification === "missing"
                ? "The verification link is incomplete. Return to the report and request a new link."
                : "We could not confirm that verification link. Return to the report and request a new link."}
          </p>
        ) : null}
        <ul className="hx-report-grid hx-wrap">
          {publications.map((publication) => (
            <li key={publication.slug}>
              <Link href={`/publications/${publication.slug}`}>
                <Image src={publication.previewCover ?? publication.cover ?? ""} width={publication.previewWidth} height={publication.previewHeight} alt={`${publication.plainTitle} cover`} sizes="(max-width: 960px) 360px, 30vw" />
                <span className="hx-report-meta">{publication.published} · Volume 1</span>
                <strong>{publication.plainTitle}</strong>
                <span className="hx-report-finding">{publication.listFinding}</span>
                <span className="hx-report-cta">Read the report</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            healthPageSchema("Publications", "/publications", "CollectionPage"),
          ),
        }}
      />
    </HealthShell>
  );
}
