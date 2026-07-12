import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://health.sozorockfoundation.org";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/privacy`, lastModified: new Date("2026-07-11"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date("2026-07-11"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/accessibility`, lastModified: new Date("2026-07-11"), changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/nondiscrimination`, lastModified: new Date("2026-07-11"), changeFrequency: "yearly", priority: 0.4 },
  ];
}
