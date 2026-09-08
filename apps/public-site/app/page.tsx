import type { Metadata } from "next";
import { HealthHome } from "./components/HealthHome";
import { healthMetadata } from "./lib/health-metadata";

export const metadata: Metadata = {
  ...healthMetadata(
    "Systems for health access",
    "Community access, place-based intelligence, digital assurance and workforce capacity. Explore SozoRock Health's systems, research and partnership opportunities.",
    "/",
  ),
  alternates: {
    canonical: "/",
    languages: { "en-US": "/", "es-US": "/es" },
  },
};

export default function Home() {
  return <HealthHome />;
}
