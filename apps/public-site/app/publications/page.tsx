import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
import Link from "next/link";
import { HealthShell } from "../components/HealthShell";
import { publications } from "../lib/publications";
import styles from "./publications.module.css";

export const metadata = healthMetadata(
  "Research and publications",
  "Read publications on rural equity, public governance and health systems assurance by Dr. Oluwabiyi Adeyemo. View editions and request access.",
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
      <div className={styles.page}>
        <main id="health-main" className={styles.main}>
          <div className={styles.formIntro}>
            <p>Publications</p>
            <h1>Research for stronger health systems.</h1>
            <p>
              Research by Dr. Oluwabiyi Adeyemo on rural health access,
              local governance and digital assurance. Each record includes its
              scope, publication details and full-text access.
            </p>
          </div>
          {verification ? (
            <p className={styles.error} role="alert">
              {verification === "expired"
                ? "That verification link has expired or was already used. Return to the publication and submit the access form again for a new link."
                : verification === "missing"
                  ? "The verification link is incomplete. Return to the publication and submit the access form again."
                  : "We could not confirm that verification link. Return to the publication and request a new link."}
            </p>
          ) : null}
          <div className={styles.list}>
            {publications.map((publication) => (
              <article key={publication.slug} className={styles.listItem}>
                <div className={styles.listRecord}>
                  <p className={styles.status}>{publication.published}</p>
                  <p>Volume 1</p>
                </div>
                <div>
                  <p className={styles.status}>{publication.status}</p>
                  <h2><Link href={`/publications/${publication.slug}`}>{publication.title}</Link></h2>
                  <p>{publication.description}</p>
                  {publication.doi && <p className={styles.publicationDoi}><a href={`https://doi.org/${publication.doi}`}>DOI: {publication.doi}</a></p>}
                  <Link href={`/publications/${publication.slug}`}>
                    Read overview and access publication
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
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
