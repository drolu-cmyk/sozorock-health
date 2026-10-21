export const dynamic = "force-static";
export const revalidate = 3600;
import { ApprovedHealthPage } from "../components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
const title = "Primary Care Access Program in New York";
export const metadata = healthMetadata(title, "A year of sponsored primary care for up to 25 New Yorkers living with a chronic condition, starting January 2027. Explore eligibility, evidence and sponsorship.", "/primary-care-access");
export default function Page() { return <><ApprovedHealthPage pathname="/primary-care-access" /><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(healthPageSchema(title, "/primary-care-access"))}} /></>; }
