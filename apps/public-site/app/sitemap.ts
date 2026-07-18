import type { MetadataRoute } from "next";
import { publications } from "./lib/publications";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://health.sozorockfoundation.org";
  const publicationRoutes: MetadataRoute.Sitemap = publications.map(
    (publication) => ({
      url: `${base}/publications/${publication.slug}`,
      lastModified: new Date("2026-07-11"),
      changeFrequency:
        publication.status === "Available" ? "monthly" : "weekly",
      priority: publication.status === "Available" ? 0.7 : 0.6,
    }),
  );

  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { en: base, es: `${base}/es` } },
    },
    {
      url: `${base}/es`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: { languages: { en: base, es: `${base}/es` } },
    },
    { url: `${base}/explore`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/publications`, lastModified: new Date("2026-07-11"), changeFrequency: "weekly", priority: 0.8 },
    ...publicationRoutes,
    { url: `${base}/contact`, lastModified: new Date("2026-07-17"), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`, lastModified: new Date("2026-07-11"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date("2026-07-11"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/accessibility`, lastModified: new Date("2026-07-11"), changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/nondiscrimination`, lastModified: new Date("2026-07-11"), changeFrequency: "yearly", priority: 0.4 },
  ];
}
