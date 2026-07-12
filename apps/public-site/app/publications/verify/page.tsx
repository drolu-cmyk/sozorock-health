import type { Metadata } from "next";
import Link from "next/link";
import { LogoLockup } from "../../components/LogoLockup";
import styles from "../publications.module.css";

export const metadata: Metadata = { title: "Confirm publication access", robots: { index: false, follow: false } };

export default async function ConfirmPublicationAccess({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token?.slice(0, 160) ?? "";
  return <div className={styles.page}><header className={styles.header}><LogoLockup/><Link href="/publications">All publications</Link></header><main className={styles.formWrap}><section className={styles.confirmation}><p className={styles.status}>Email confirmed</p><h1>Continue to your publication.</h1><p>Select continue to verify this one-time link. This protects the link from being consumed automatically by email security scanners.</p>{token ? <form action="/api/publications/verify" method="post"><input type="hidden" name="token" value={token}/><button className={styles.primary} type="submit">Continue securely</button></form> : <><p role="alert">This verification link is incomplete.</p><Link href="/publications">Request a new link</Link></>}</section></main></div>;
}
