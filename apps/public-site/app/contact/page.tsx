import { ApprovedHealthPage } from "../components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
export const metadata = healthMetadata(
  "Health Equity Partnerships",
  "Discuss Health Equity Hubs, provider readiness, county evidence or workforce learning with SozoRock Health.",
  "/contact",
);
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{
    interest?: string | string[];
    location?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const initialInterest = (
    Array.isArray(params.interest)
      ? params.interest[0]
      : (params.interest ?? "")
  ).slice(0, 160);
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
        __html: JSON.stringify(healthPageSchema("Health Equity Partnerships", "/contact", "ContactPage")),
      }}
    />
  </>;
}
