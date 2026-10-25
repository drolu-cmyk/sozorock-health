export const dynamic = "force-static";
export const revalidate = 3600;

import { ApprovedHealthPage } from "../components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema, programSocialImage } from "../lib/health-metadata";

const title = "Primary Care Access Program Interest List";
export const metadata = healthMetadata(
  title,
  "Join the interest list for SozoRock's Primary Care Access Program for up to 25 New Yorkers beginning January 2027.",
  "/interest",
  { image: programSocialImage },
);

export default function InterestPage() {
  return <>
    <ApprovedHealthPage pathname="/interest" />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(healthPageSchema(title, "/interest")) }} />
  </>;
}
