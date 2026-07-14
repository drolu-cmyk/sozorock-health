import type { MetadataRoute } from "next";

const dashboardUrl = "https://cbcap.sozorockfoundation.org";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: dashboardUrl,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
