import type { MetadataRoute } from "next";

const dashboardUrl = "https://cbcap.sozorockfoundation.org";

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
