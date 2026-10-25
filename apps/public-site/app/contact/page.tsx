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
  const initialInterest = pick(params.audience).slice(0, 40);
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
