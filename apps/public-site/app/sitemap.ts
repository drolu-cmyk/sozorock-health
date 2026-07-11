import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://health.sozorockfoundation.org", lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
}
