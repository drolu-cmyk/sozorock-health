import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LogoLockup } from "../components/LogoLockup";
import { publications } from "../lib/publications";
import styles from "./publications.module.css";

export const metadata: Metadata = {
  title: "Publications",
  description:
    "Public-interest publications by Oluwabiyi Adeyemo on rural health access, public systems, governance, and digital assurance.",
  alternates: { canonical: "/publications" },
};

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ verification?: string }>;
}) {
  const verification = (await searchParams).verification;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <LogoLockup />
        <Link href="/">Return home</Link>
      </header>
      <main className={styles.main}>
        <div className={styles.formIntro}>
          <p>Publications</p>
          <h1>Ideas that shape the work.</h1>
          <p>
            Oluwabiyi Adeyemo&rsquo;s publications examine how health access,
            public systems, technology, and accountability can work together.
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
              {publication.cover ? (
                <a
                  className={styles.listCoverLink}
                  href={publication.cover}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`View the full-resolution front cover of ${publication.title}`}
                >
                  <Image
                    src={publication.cover}
                    alt={`${publication.title} front cover`}
                    width={publication.coverWidth ?? 2550}
                    height={publication.coverHeight ?? 3300}
                    quality={95}
                    sizes="(max-width: 700px) 110px, 200px"
                  />
                  <span>View full-resolution cover</span>
                </a>
              ) : (
                <div className={styles.listPlaceholder}>
                  Series in development
                </div>
              )}
              <div>
                <p className={styles.status}>{publication.status}</p>
                <h2>{publication.title}</h2>
                <p>{publication.description}</p>
                <Link href={`/publications/${publication.slug}`}>
                  View publication
                </Link>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
