import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./marketing.css";

const siteUrl = "https://health.sozorockfoundation.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "SozoRock Health | Non-clinical health systems infrastructure", template: "%s | SozoRock Health" },
  description: "Nationwide non-clinical health access, workforce-readiness, AI-readiness, digital assurance, and county systems infrastructure for rural and underserved communities.",
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
    title: "SozoRock Health | Stronger systems, closer to home",
    description: "National non-clinical health, workforce-readiness, and systems infrastructure for rural and underserved communities.",
    url: siteUrl,
    siteName: "SozoRock Health",
    type: "website",
    locale: "en_US",
    images: [{ url: "/social/sozorock-health-og.jpg", width: 1200, height: 630, alt: "A Health Equity Hub team member supporting a resident's digital readiness in a rural library" }],
  },
  twitter: { card: "summary_large_image", title: "SozoRock Health | Stronger systems, closer to home", description: "National non-clinical health, workforce-readiness, and systems infrastructure.", images: ["/social/sozorock-health-og.jpg"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f385b", colorScheme: "light" };

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "The SozoRock Foundation, Inc.", url: "https://sozorockfoundation.org", logo: `${siteUrl}/brand/sozorock-wordmark-clean-v2.png`, email: "contact@sozorockfoundation.org", nonprofitStatus: "Nonprofit501c3", areaServed: { "@type": "Country", name: "United States" } },
    { "@type": "WebSite", "@id": `${siteUrl}/#website`, url: siteUrl, name: "SozoRock Health", description: "Nationwide non-clinical health, workforce-readiness, and systems infrastructure.", publisher: { "@id": `${siteUrl}/#organization` }, inLanguage: ["en-US", "es-US"] },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}/></body></html>;
}
