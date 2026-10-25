import { redirect } from "next/navigation";
import { ApprovedHealthPage } from "../components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
export const metadata = healthMetadata(
  "Work With Us",
  "Providers, counties, funders and researchers: tell SozoRock Health how you want to bring care closer to the people you serve.",
  "/contact",
);
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{
    audience?: string | string[];
    interest?: string | string[];
    location?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : (value ?? ""));
  const legacy = new Map<string, string>([
    ["Media inquiry", "media"],
    ["Research partnership", "media"],
    ["Support research and publications", "media"],
    ["Fund the work", "funders"],
    ["BYOP provider partnership", "providers"],
    ["Partner with us", "counties"],
    ["Workforce partnership", "counties"],
    ["CB-CAP inquiry", "counties"],
    ["Health Access Day partnership", "counties"],
    ["Health Equity Hub partnership", "counties"],
    ["Institutional or public-sector inquiry", "counties"],
  ]);
  if (pick(params.interest) === "Bring the model to a community") redirect("/interest");
  const initialInterest = (pick(params.audience) || legacy.get(pick(params.interest)) || "").slice(0, 40);
  const initialLocation = (
    Array.isArray(params.location)
      ? params.location[0]
      : (params.location ?? "")
  )
    .trim()
    .slice(0, 120);
  return <>
    <ApprovedHealthPage pathname="/contact" initialInterest={initialInterest} initialLocation={initialLocation} />
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(healthPageSchema("Contact", "/contact", "ContactPage")),
      }}
    />
  </>;
}
