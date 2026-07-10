import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://health.sozorockfoundation.org"),
  title: "SozoRock Health | Access where people live",
  description: "AI-native, non-clinical access infrastructure connecting rural and underserved residents to licensed providers nationwide.",
  openGraph: { title: "SozoRock Health", description: "Access where people live.", type: "website" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
