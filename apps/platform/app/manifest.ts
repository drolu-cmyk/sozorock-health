import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CB-CAP — Nationwide County Systems Intelligence",
    short_name: "CB-CAP",
    description:
      "Nationwide public-data intelligence for health priorities, pathway barriers, transparent scenarios, and accountable county planning questions.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f0e8",
    theme_color: "#0e2821",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
