import { ApprovedHealthPage } from "../components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
export const metadata = healthMetadata('Health Equity Initiative', 'The Primary Care Access Program launches January 2027 alongside proposed Health Equity Hubs, county evidence and workforce learning.', '/work');
export default function Page() {return <><ApprovedHealthPage pathname="/work"/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(healthPageSchema('Health Equity Initiative', '/work'))}} /></>;}
