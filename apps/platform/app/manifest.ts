import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CB-CAP — County-Based Community Access Platform",
    short_name: "CB-CAP",
    description:
      "Privacy-preserving county systems intelligence for planning and readiness.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f0e8",
    theme_color: "#10251e",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
