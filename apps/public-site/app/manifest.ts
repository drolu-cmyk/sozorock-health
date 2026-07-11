import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "SozoRock Health", short_name: "SozoRock Health", description: "Nationwide, AI-native, non-clinical access infrastructure.", start_url: "/", display: "standalone", background_color: "#fffdf8", theme_color: "#0f385b", icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }, { src: "/apple-icon.png", sizes: "180x180", type: "image/png" }] };
}
