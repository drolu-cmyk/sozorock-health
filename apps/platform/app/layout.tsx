import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./styles.css";
const dashboardUrl = "https://cbcap.sozorockfoundation.org";
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
export const metadata: Metadata = {
  metadataBase: new URL(dashboardUrl),
  title: "CB-CAP | County Planning for Health Access | SozoRock Foundation",
  description:
    "CB-CAP brings county health evidence, access barriers, local context, funding and workforce considerations into one accountable planning workspace.",
  applicationName: "CB-CAP",
  authors: [
    {
      name: "The SozoRock Foundation, Inc.",
      url: "https://sozorockfoundation.org",
    },
  ],
  creator: "The SozoRock Foundation, Inc.",
  publisher: "The SozoRock Foundation, Inc.",
  category: "county health planning",
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
    title: "CB-CAP | County Planning for Health Access",
    description:
      "From evidence to a plan you can defend. Explore a real county in the Public Evidence Preview.",
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
    title: "CB-CAP | County Planning for Health Access",
    description:
      "County planning for health access. Sources stay visible. Assumptions stay labeled. People decide.",
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
    "CB-CAP connects county evidence with accountable planning. Public evidence is available in the preview; institutional workflows require authorized access and active capabilities.",
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
      <body className={dmSans.variable}>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </body>
    </html>
  );
}
