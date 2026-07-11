import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./marketing.css";

const siteUrl = "https://health.sozorockfoundation.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "SozoRock Health | Access where people live", template: "%s | SozoRock Health" },
  description: "AI-native, non-clinical access infrastructure connecting rural and underserved residents to licensed providers through trusted hubs and accessible technology nationwide.",
  applicationName: "SozoRock Health",
  authors: [{ name: "The SozoRock Foundation, Inc.", url: "https://sozorockfoundation.org" }],
  creator: "The SozoRock Foundation, Inc.",
  publisher: "The SozoRock Foundation, Inc.",
  category: "health access infrastructure",
  keywords: ["rural health access", "health equity", "licensed providers", "county health intelligence", "CB-CAP", "community health hubs", "voice access", "SozoRock Health"],
  alternates: { canonical: "/" },
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "SozoRock Health | Access where people live",
    description: "A national, AI-native, non-clinical access infrastructure for rural and underserved communities.",
    url: siteUrl,
    siteName: "SozoRock Health",
    type: "website",
    locale: "en_US",
    images: [{ url: "/social/sozorock-health-og.jpg", width: 1200, height: 630, alt: "A community navigator helping a resident use a SozoRock Health access pathway at a rural library hub" }],
  },
  twitter: { card: "summary_large_image", title: "SozoRock Health | Access where people live", description: "National, non-clinical access infrastructure connecting residents to licensed providers.", images: ["/social/sozorock-health-og.jpg"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f385b", colorScheme: "light" };

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "The SozoRock Foundation, Inc.", url: "https://sozorockfoundation.org", logo: `${siteUrl}/brand/sozorock-wordmark-transparent.png`, email: "contact@sozorockfoundation.org", nonprofitStatus: "Nonprofit501c3", areaServed: { "@type": "Country", name: "United States" } },
    { "@type": "WebSite", "@id": `${siteUrl}/#website`, url: siteUrl, name: "SozoRock Health", description: "Nationwide, AI-native, non-clinical access infrastructure.", publisher: { "@id": `${siteUrl}/#organization` }, inLanguage: ["en-US", "es-US"] },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}/></body></html>;
}
