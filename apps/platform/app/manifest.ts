import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CB-CAP | County Planning for Health Access",
    short_name: "CB-CAP",
    description:
      "From evidence to a plan you can defend.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfcfd",
    theme_color: "#172b42",
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
