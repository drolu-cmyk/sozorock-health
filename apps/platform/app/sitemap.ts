import type { MetadataRoute } from "next";

const dashboardUrl = "https://main.d307qqji18y8il.amplifyapp.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: dashboardUrl,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
