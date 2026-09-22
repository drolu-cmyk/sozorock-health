import { ApprovedHealthPage } from "../components/ApprovedHealthPages";
import { healthMetadata } from "../lib/health-metadata";
export const metadata = healthMetadata(
  "Partner with Health",
  "Discuss community access, provider readiness, workforce capacity or research with SozoRock Health. Discuss a health partnership, community project or funding opportunity.",
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
  return <ApprovedHealthPage pathname="/contact" initialInterest={initialInterest} initialLocation={initialLocation} />;
}
