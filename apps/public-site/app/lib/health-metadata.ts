import type { Metadata } from "next";
import { SPANISH_PAGES, spanishPath } from "./language-paths.ts";

export const healthOrigin = "https://health.sozorockfoundation.org";
export const foundationEntity =
  "https://www.sozorockfoundation.org/#organization";
export const healthSocialImage = {
  url: "/social/primary-care-access-2027.png",
  width: 1200,
  height: 630,
  alt: "SozoRock Health. Primary Care Access Program for up to 25 New Yorkers, beginning January 2027.",
};

function languageAlternates(path: string): Metadata["alternates"] {
  const english = path === "/es" ? "/" : path.replace(/^\/es\//, "/");
  if (!(SPANISH_PAGES as readonly string[]).includes(english)) return { canonical: path };
  return { canonical: path, languages: { "en-US": english, "es-US": spanishPath(english) } };
}

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
    keywords: path === "/" || path === "/interest"
      ? ["SozoRock Health", "Primary Care Access Program", "New York primary care access", "sponsored direct primary care", "health access support"]
      : ["SozoRock Health", title, "health equity", "community health access"],
    alternates: languageAlternates(path),
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
        inLanguage: path === "/es" ? "es-US" : "en-US",
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
