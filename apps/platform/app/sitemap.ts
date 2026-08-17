import type { MetadataRoute } from "next";
import { dashboardUrl } from "./site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: dashboardUrl,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
