import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Sans, Newsreader } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "./marketing.css";
import "./health-system.css";
import "./health-program.css";
import "./approved.css";
import "./access-refinements.css";
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
    default: "SozoRock Health | Health equity and primary care access.",
    template: "%s | SozoRock Health",
  },
  description:
    "New York primary care access support, proposed Health Equity Hubs and public county health evidence from SozoRock Health.",
  applicationName: "SozoRock Health",
  authors: [
    {
      name: "The SozoRock Foundation, Inc.",
      url: "https://www.sozorockfoundation.org",
    },
    { name: "Dr. Oluwabiyi Adeyemo" },
  ],
  creator: "SozoRock Health",
  publisher: "The SozoRock Foundation, Inc.",
  category: "nonprofit health access",
  keywords: ["SozoRock Health", "Primary Care Access Program", "New York primary care access", "sponsored direct primary care", "health literacy", "county health evidence"],
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/health-icon.svg", sizes: "any", type: "image/svg+xml" }, { url: "/icon.png", sizes: "512x512", type: "image/png" }],
    shortcut: "/health-icon.svg",
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
    title: "SozoRock Health | Health equity and primary care access",
    description:
      "Primary care access support for eligible New Yorkers, proposed community hubs and county evidence with visible sources and limits.",
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
    title: "SozoRock Health | Health equity and primary care access.",
    description:
      "The Primary Care Access Program begins January 2027 for up to 25 New Yorkers, with 12 months of support per participant.",
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
      "@type": "Project",
      "@id": `${siteUrl}/#sozorock-health`,
      name: "SozoRock Health",
      alternateName: "SozoRock Health Equity Initiative",
      url: siteUrl,
      slogan: "Care. For every ZIP Code.",
      logo: `${siteUrl}/icon.png`,
      description:
        "The Foundation’s health initiative: primary care access support in New York, proposed Health Equity Hubs and public county health evidence.",
      parentOrganization: { "@id": foundationEntity },
      creator: { "@id": foundationEntity },
      areaServed: { "@type": "Country", name: "United States" },
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "SozoRock Health",
      alternateName: "SozoRock Health website",
      description:
        "Program information, eligibility, the Primary Care Access Program interest list and sourced county health evidence from SozoRock Health.",
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
