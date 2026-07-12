import type { Metadata, Viewport } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "./styles.css";
const dashboardUrl = "https://main.d307qqji18y8il.amplifyapp.com";
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });
export const metadata: Metadata = {
  metadataBase: new URL(dashboardUrl),
  title: "CB-CAP | County Systems Intelligence | SozoRock Health",
  description:
    "Privacy-preserving county systems intelligence for pathway visibility, Health Equity Hub and Health Access Day planning, Community Health Assessment and Community Health Improvement Plan support, workforce development, AI readiness, governance, and public-sector modernization.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "CB-CAP | County-Based Community Access Platform",
    description:
      "Privacy-preserving county systems intelligence for planning, readiness, governance, and public-sector modernization.",
    url: dashboardUrl,
    siteName: "CB-CAP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CB-CAP | County Systems Intelligence",
    description:
      "Privacy-preserving county systems intelligence for planning and readiness.",
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
    "Privacy-preserving county systems intelligence supporting Health Equity Hub planning, Health Access Day planning, CHA and CHIP support, and systems learning.",
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
