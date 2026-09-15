import type { Metadata } from "next";
import { HealthHome } from "./components/HealthHome";
import { healthMetadata } from "./lib/health-metadata";

export const metadata: Metadata = {
  ...healthMetadata(
    "Systems for health access",
    "Community access models, local evidence and digital readiness for rural health. Explore SozoRock Health’s research and collaboration opportunities.",
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
