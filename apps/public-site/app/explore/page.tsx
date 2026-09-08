import type { Metadata } from "next";
import { ExploreClient } from "./ExploreClient";
import { readExploreState } from "../lib/explore-view-state";
import { foundationEntity, healthMetadata, healthOrigin } from "../lib/health-metadata";
const description = "Explore county evidence on health access, community conditions and workforce capacity. Compare measures and inspect original sources, dates and limitations.";
const social = { url: "/social/place-intelligence-2026.png", width: 1200, height: 630, alt: "SozoRock Place Intelligence — County evidence, in context." };
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const query = await searchParams;
  const metadata = healthMetadata("SozoRock Place Intelligence", description, "/explore", { noindex: Object.keys(query).length > 0 });
  return { ...metadata, openGraph: { ...metadata.openGraph, images: [social] }, twitter: { ...metadata.twitter, images: [social.url] } };
}
const schema = {
  "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": `${healthOrigin}/explore#webpage`, url: `${healthOrigin}/explore`, name: "SozoRock Place Intelligence", description,
      isPartOf: { "@id": `${healthOrigin}/#website` }, about: { "@id": `${healthOrigin}/explore#application` }, inLanguage: "en-US" },
    { "@type": "WebApplication", "@id": `${healthOrigin}/explore#application`, name: "SozoRock Place Intelligence", url: `${healthOrigin}/explore`,
      applicationCategory: "ReferenceApplication", operatingSystem: "Web browser", isAccessibleForFree: true, provider: { "@id": foundationEntity } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "SozoRock Health", item: healthOrigin },
      { "@type": "ListItem", position: 2, name: "Place Intelligence", item: `${healthOrigin}/explore` },
    ] },
  ],
};
export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const params = new URLSearchParams(Object.entries(query).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
  return <><ExploreClient initialState={readExploreState(params)}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
