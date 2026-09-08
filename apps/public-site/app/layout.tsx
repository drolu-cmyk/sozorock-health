import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Sans, Newsreader } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "./marketing.css";
import "./health-system.css";
import { foundationEntity, healthSocialImage } from "./lib/health-metadata";

const siteUrl = "https://health.sozorockfoundation.org";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  preload: false,
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  preload: false,
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SozoRock Health | Systems for health access.",
    template: "%s | SozoRock Health",
  },
  description:
    "Community access models, place-based intelligence, digital assurance and workforce capacity for more accountable health systems.",
  applicationName: "SozoRock Health",
  authors: [
    {
      name: "The SozoRock Foundation, Inc.",
      url: "https://sozorockfoundation.org",
    },
    { name: "Oluwabiyi Adeyemo" },
  ],
  creator: "Oluwabiyi Adeyemo and The SozoRock Foundation, Inc.",
  publisher: "The SozoRock Foundation, Inc.",
  category: "health systems infrastructure",
  keywords: [
    "SozoRock",
    "SozoRock Health",
    "SozoRock Foundation",
    "Oluwabiyi Adeyemo",
    "Olu Adeyemo",
    "Biyi Adeyemo",
    "health equity",
    "rural health",
    "underserved communities",
    "Health Equity Hubs",
    "Health Access Day",
    "BYOP provider pathways",
    "CB-CAP",
    "county health planning",
    "digital health access",
    "public health systems",
    "AI readiness",
    "cybersecurity readiness",
    "workforce development",
  ],
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/icon.png", sizes: "512x512", type: "image/png" }],
    shortcut: "/icon.png",
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SozoRock Health",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    title: "SozoRock Health | Systems for health access",
    description:
      "Health-equity systems infrastructure for people, communities, licensed providers, institutions, and public agencies across the United States.",
    url: siteUrl,
    siteName: "SozoRock Health",
    type: "website",
    locale: "en_US",
    images: [healthSocialImage],
  },
  twitter: {
    card: "summary_large_image",
    site: "@srockfoundation",
    creator: "@srockfoundation",
    title: "SozoRock Health | Systems for health access.",
    description:
      "Health-equity systems infrastructure for practical access, community readiness, provider-led pathways, and stronger public systems.",
    images: [healthSocialImage.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0644ad",
  colorScheme: "light",
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": foundationEntity,
      name: "The SozoRock Foundation, Inc.",
      alternateName: ["SozoRock Foundation", "SozoRock"],
      url: "https://www.sozorockfoundation.org",
      logo: `${siteUrl}/brand/sozorock-wordmark-clean-v2.png`,
      email: "contact@sozorockfoundation.org",
      areaServed: { "@type": "Country", name: "United States" },
      sameAs: [
        "https://x.com/srockfoundation",
        "https://www.youtube.com/@srockfoundation",
        "https://www.instagram.com/srockfoundation/",
      ],
    },
    {
      "@type": "Project",
      "@id": `${siteUrl}/#sozorock-health`,
      name: "SozoRock Health",
      alternateName: "SozoRock",
      url: siteUrl,
      slogan: "Systems for health access.",
      description:
        "An initiative developing community access models, place-based intelligence, digital readiness and workforce capacity.",
      parentOrganization: { "@id": foundationEntity },
      creator: { "@id": foundationEntity },
      areaServed: { "@type": "Country", name: "United States" },
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "SozoRock Health",
      alternateName: "SozoRock",
      description:
        "Health-equity systems infrastructure for rural and underserved communities across the United States.",
      publisher: { "@id": foundationEntity },
      about: { "@id": `${siteUrl}/#sozorock-health` },
      inLanguage: ["en-US", "es-US"],
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const language =
    (await headers()).get("x-sozorock-language") === "es" ? "es" : "en";
  return (
    <html lang={language}>
      <body
        className={`${dmSans.variable} ${newsreader.variable} ${instrumentSans.variable}`}
      >
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
