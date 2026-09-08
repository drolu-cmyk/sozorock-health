import type { Metadata } from "next";
import { HealthHome } from "./components/HealthHome";
import { healthMetadata } from "./lib/health-metadata";

export const metadata: Metadata = {
  ...healthMetadata(
    "Systems for health access",
    "Community access models, place-based intelligence, digital readiness and workforce development. Explore SozoRock Health's work and partnership opportunities.",
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
