import type { Metadata } from "next";

export const healthOrigin = "https://health.sozorockfoundation.org";
export const foundationEntity =
  "https://www.sozorockfoundation.org/#organization";
export const healthSocialImage = {
  url: "/social/health-systems-2026.png",
  width: 1200,
  height: 630,
  alt: "SozoRock Health — Building the systems that make health access possible.",
};

export function healthMetadata(
  title: string,
  description: string,
  path: string,
  options: { noindex?: boolean; spanish?: boolean } = {},
): Metadata {
  const fullTitle = `${title} | SozoRock Health`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    robots: { index: !options.noindex, follow: true },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: "SozoRock Health",
      type: "website",
      locale: options.spanish ? "es_US" : "en_US",
      images: [healthSocialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [healthSocialImage.url],
    },
  };
}

export function healthPageSchema(
  title: string,
  path: string,
  type = "WebPage",
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": type,
        "@id": `${healthOrigin}${path}#webpage`,
        url: `${healthOrigin}${path}`,
        name: title,
        isPartOf: { "@id": `${healthOrigin}/#website` },
        about: { "@id": `${healthOrigin}/#sozorock-health` },
      },
      ...(path === "/" || path === "/es"
        ? []
        : [
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "SozoRock Health",
                  item: healthOrigin,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: title,
                  item: `${healthOrigin}${path}`,
                },
              ],
            },
          ]),
    ],
  };
}
