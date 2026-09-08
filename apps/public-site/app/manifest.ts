import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SozoRock Health",
    short_name: "SozoRock Health",
    description:
      "Community access, evidence, digital readiness and workforce capacity.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0644ad",
    icons: [
      {
        src: "/brand/health-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
