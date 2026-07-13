import type { MetadataRoute } from "next";

const dashboardUrl = "https://main.d307qqji18y8il.amplifyapp.com";

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
