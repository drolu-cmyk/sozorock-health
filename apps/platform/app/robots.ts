import type { MetadataRoute } from "next";
import { dashboardUrl } from "./site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${dashboardUrl}/sitemap.xml`,
    host: dashboardUrl,
  };
}
