import type { Metadata } from "next";

const socialImage = {
  url: "/social/sozorock-health-og.jpg",
  width: 1200,
  height: 630,
  alt: "An illustrated path moves from uncertainty toward local support beneath the SozoRock Health message",
};

export function createLegalMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: `/${string}`;
}): Metadata {
  const socialTitle = `${title} | SozoRock Health`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: socialTitle,
      description,
      url: path,
      siteName: "SozoRock Health",
      type: "website",
      locale: "en_US",
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [socialImage.url],
    },
  };
}
