import type { Metadata } from "next";
import { ExploreClient } from "./ExploreClient";

const siteUrl = "https://health.sozorockfoundation.org";
const exploreStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/explore#webpage`,
      url: `${siteUrl}/explore`,
      name: "SozoRock Place Intelligence | SozoRock Health",
      description: "Current public data organized by place to support health equity, community health planning and practical action.",
      isPartOf: { "@id": `${siteUrl}/#website` },
      about: { "@id": `${siteUrl}/#sozorock-health` },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/explore#application`,
      name: "SozoRock Place Intelligence",
      url: `${siteUrl}/explore`,
      applicationCategory: "Public health planning",
      operatingSystem: "Web",
      isAccessibleForFree: true,
      provider: { "@id": `${siteUrl}/#organization` },
    },
  ],
};

export const metadata: Metadata = {
  title: "SozoRock Place Intelligence",
  description:
    "Search any U.S. ZIP Code, city or county to compare current public-health measures, review evidence strength, map local patterns and see place-based opportunities for community health improvement.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "SozoRock Place Intelligence | SozoRock Health",
    description:
      "Current public data organized by place to support health equity, community health planning and practical action.",
    url: "/explore",
    images: ["/social/sozorock-health-social-2026-07.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    site: "@srockfoundation",
    creator: "@srockfoundation",
    title: "SozoRock Place Intelligence | SozoRock Health",
    description: "Current public data organized by place to support health equity, community health planning and practical action.",
    images: ["/social/sozorock-health-social-2026-07.jpg"],
  },
};

export default function ExplorePage() {
  return <><ExploreClient /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(exploreStructuredData) }} /></>;
}
