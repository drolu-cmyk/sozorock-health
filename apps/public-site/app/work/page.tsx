export const dynamic = "force-static";
export const revalidate = 3600;

import { ApprovedHealthPage } from "../components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
export const metadata = healthMetadata('Health Equity Initiative', 'Health Equity Hubs, Health Access Day and the Primary Care Access Program help people reach the licensed providers who serve them. SozoRock Health does not provide medical care.', '/work');
export default function Page() {return <><ApprovedHealthPage pathname="/work"/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(healthPageSchema('Health Equity Initiative', '/work'))}} /></>;}
