import type { Metadata, Viewport } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "./styles.css";
const dashboardUrl = "https://cbcap.sozorockfoundation.org";
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });
export const metadata: Metadata = {
  metadataBase: new URL(dashboardUrl),
  title: "CB-CAP | Nationwide County Systems Intelligence | SozoRock Health",
  description:
    "Explore public estimates and coverage gaps across all 3,144 U.S. county equivalents, with transparent planning scenarios, Health Equity Hub questions, and CHA/CHIP evidence support.",
  applicationName: "CB-CAP",
  authors: [
    {
      name: "The SozoRock Foundation, Inc.",
      url: "https://sozorockfoundation.org",
    },
  ],
  creator: "The SozoRock Foundation, Inc.",
  publisher: "The SozoRock Foundation, Inc.",
  category: "public health planning and county systems intelligence",
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "192x192" }],
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "CB-CAP | Nationwide County Systems Intelligence",
    description:
      "Explore public health estimates, coverage gaps, planning scenarios, and CHA/CHIP evidence questions across all 3,144 U.S. county equivalents.",
    url: dashboardUrl,
    siteName: "CB-CAP",
    type: "website",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "SozoRock wordmark",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "CB-CAP | Nationwide County Systems Intelligence",
    description:
      "Nationwide public-data intelligence for health priorities, pathway barriers, transparent scenarios, and accountable planning questions.",
    images: ["/icon-512.png"],
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10271f",
};
const schema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "County-Based Community Access Platform",
  alternateName: "CB-CAP",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  url: dashboardUrl,
  description:
    "Nationwide public-data county systems intelligence supporting health-priority analysis, Health Equity Hub and Health Access Day planning questions, CHA and CHIP evidence support, workforce planning questions, and accountable systems learning.",
  provider: {
    "@type": "NGO",
    name: "The SozoRock Foundation, Inc.",
    url: "https://www.sozorockfoundation.org",
  },
  areaServed: {
    "@type": "Country",
    name: "United States",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${newsreader.variable}`}>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </body>
    </html>
  );
}
