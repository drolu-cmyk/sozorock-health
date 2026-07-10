import type { Metadata } from "next";
import "./globals.css";
import "./refinement.css";

export const metadata: Metadata = {
  title: "SozoRock Health | Access infrastructure",
  description: "Nationwide, non-clinical access infrastructure connecting residents to licensed providers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
