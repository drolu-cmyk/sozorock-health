import Head from "next/head";
import Link from "next/link";

export default function ServerErrorPage() {
  return (
    <>
      <Head>
        <title>Page unavailable | SozoRock Health</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "96px 24px",
          fontFamily: "system-ui, sans-serif",
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: "0.08em" }}>
          SOZOROCK HEALTH
        </p>
        <h1 style={{ margin: "16px 0 12px", fontSize: 42, lineHeight: 1.1 }}>
          This page is temporarily unavailable.
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 18 }}>
          Please try again shortly. No action is required on your account.
        </p>
        <Link href="/">Return to SozoRock Health</Link>
      </main>
    </>
  );
}
