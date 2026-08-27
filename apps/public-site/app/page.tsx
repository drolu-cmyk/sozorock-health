import type { Metadata } from "next";
import { ApprovedMarketingHome } from "./components/ApprovedMarketingHome";

const siteUrl = "https://health.sozorockfoundation.org";
const homeStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${siteUrl}/#webpage`,
  url: siteUrl,
  name: "SozoRock Health | Care. For every ZIP Code.",
  isPartOf: { "@id": `${siteUrl}/#website` },
  about: { "@id": `${siteUrl}/#sozorock-health` },
  primaryImageOfPage: {
    "@type": "ImageObject",
    url: `${siteUrl}/social/sozorock-health-social-2026-07.jpg`,
    width: 1200,
    height: 630,
  },
  inLanguage: "en-US",
};

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: { "en-US": "/", "es-US": "/es" },
  },
};

export default function Home() {
  return <><ApprovedMarketingHome /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeStructuredData) }} /></>;
}
