import type { Metadata } from "next";
import { ExploreClient } from "./ExploreClient";

export const metadata: Metadata = {
  title: "Explore local health priorities",
  description:
    "Search any U.S. ZIP Code, city or county to compare current public-health measures, map local patterns and see place-based opportunities for community health improvement.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "Explore local health priorities | SozoRock Health",
    description:
      "Current public data organized by place to support health equity, community health planning and practical action.",
    url: "/explore",
    images: ["/social/sozorock-health-social-2026-07.jpg"],
  },
};

export default function ExplorePage() {
  return <ExploreClient />;
}
