import { PublicCountyExplorer } from "./PublicCountyExplorer";
import { publicCountyChoices, publicCountyEvidence } from "../lib/public-county-evidence";
import { ApprovedHealthPage } from "../components/ApprovedHealthPages";
import { resolveEvidenceCounty } from "../lib/county-resolution";
import type { Metadata } from "next";
import { ExploreClient } from "./ExploreClient";
import { readExploreState } from "../lib/explore-view-state";
import { foundationEntity, healthMetadata, healthOrigin } from "../lib/health-metadata";
const description = "Explore published county health conditions, access barriers and preventive-care estimates. Compare counties and inspect sources, years and uncertainty.";
const social = { url: "/social/place-intelligence-2026.png", width: 1200, height: 630, alt: "SozoRock Health data and maps: health data for every county." };
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const query = await searchParams;
  const metadata = healthMetadata("Health Data for Every County", description, "/explore", { noindex: Object.keys(query).length > 0 });
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
  if (!process.env.EVIDENCE_DATABASE_CLUSTER_ARN || !process.env.EVIDENCE_DATABASE_SECRET_ARN) {
    let initialCounty="36001", notice="";
    let candidates: typeof publicCountyChoices=[];
    const kind=query.kind, geoid=typeof query.geoid === "string" ? query.geoid : "";
    if (kind === "county" || kind === "place" || kind === "zip") {
      initialCounty="";
      const resolution=await resolveEvidenceCounty({kind,geoid,label:geoid,selectedCountyGeoid:typeof query.county === "string" ? query.county : null});
      const valid=resolution.selectedCountyGeoid;
      if (valid && publicCountyChoices.some(c=>c.fips===valid)) initialCounty=valid;
      else {
        candidates=publicCountyChoices.filter(c=>resolution.counties.some(r=>r.countyGeoid===c.fips));
        notice=resolution.status === "selection_required" ? "This location intersects multiple counties. Choose one below; its figures describe that county, not the whole city or ZIP area." : "Choose a county below to view its published estimates.";
      }
    } else if (query.kind !== undefined || query.geoid !== undefined) {
      initialCounty="";
      notice="Choose a county below to view its published estimates.";
    }
    return <><ApprovedHealthPage pathname="/explore"><PublicCountyExplorer choices={publicCountyChoices} initialCounty={initialCounty} initialEvidence={publicCountyEvidence(initialCounty)} notice={notice} candidates={candidates}/></ApprovedHealthPage><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
  }
  return <><ExploreClient initialState={readExploreState(params)}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
