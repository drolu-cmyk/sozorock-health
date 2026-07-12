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
              ? "That verification link has expired or was already used. Request a new link from the publication page."
              : verification === "missing"
                ? "The verification link is incomplete."
                : "We could not verify that link. Please request a new one."}
          </p>
        ) : null}
        <div className={styles.list}>
          {publications.map((publication) => (
            <article key={publication.slug} className={styles.listItem}>
              {publication.cover ? (
                <Image
                  src={publication.cover}
                  alt=""
                  width={180}
                  height={234}
                />
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
