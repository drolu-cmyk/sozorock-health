import type { Metadata, Viewport } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "./marketing.css";

const siteUrl = "https://health.sozorockfoundation.org";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "SozoRock Health | A clearer path to care", template: "%s | SozoRock Health" },
  description: "National nonprofit systems infrastructure for rural and underserved health access, chronic-disease mitigation, digital navigation, AI and cybersecurity readiness, public-sector modernization, and workforce development.",
  applicationName: "SozoRock Health",
  authors: [{ name: "The SozoRock Foundation, Inc.", url: "https://sozorockfoundation.org" }],
  creator: "The SozoRock Foundation, Inc.",
  publisher: "The SozoRock Foundation, Inc.",
  category: "health systems infrastructure",
  keywords: ["rural health systems", "health equity infrastructure", "Health Equity Hubs", "Health Access Day", "county systems intelligence", "CB-CAP", "digital assurance", "AI readiness", "workforce readiness", "SozoRock Health"],
  alternates: { canonical: "/" },
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "SozoRock Health | A clearer path to care that already exists",
    description: "Non-clinical health access, workforce-readiness, and systems infrastructure for people, communities, institutions, and public agencies.",
    url: siteUrl,
    siteName: "SozoRock Health",
    type: "website",
    locale: "en_US",
    images: [{ url: "/social/sozorock-health-og.jpg", width: 1200, height: 630, alt: "An illustrated path moves from uncertainty toward local support beneath the SozoRock Health message" }],
  },
  twitter: { card: "summary_large_image", title: "SozoRock Health | A clearer path to care", description: "Public-interest infrastructure for non-clinical health access, community readiness, and stronger public systems.", images: ["/social/sozorock-health-og.jpg"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f385b", colorScheme: "light" };

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "The SozoRock Foundation, Inc.", url: "https://sozorockfoundation.org", logo: `${siteUrl}/brand/sozorock-wordmark-clean-v2.png`, email: "contact@sozorockfoundation.org", nonprofitStatus: "Nonprofit501c3", areaServed: { "@type": "Country", name: "United States" } },
    { "@type": "WebSite", "@id": `${siteUrl}/#website`, url: siteUrl, name: "SozoRock Health", description: "A national public-interest initiative developing non-clinical health access, workforce-readiness, and systems infrastructure while licensed care remains with licensed professionals.", publisher: { "@id": `${siteUrl}/#organization` }, inLanguage: ["en-US", "es-US"] },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const language = (await headers()).get("x-sozorock-language") === "es" ? "es" : "en";
  return <html lang={language}><body className={`${dmSans.variable} ${newsreader.variable}`}>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}/></body></html>;
}
