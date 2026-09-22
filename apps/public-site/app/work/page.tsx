import { ApprovedHealthPage } from "../components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
export const metadata = healthMetadata('Health Equity Initiative', 'Library, Community and Home Health Equity Hubs, Health Access Day, provider partnerships and workforce development.', '/work');
export default function Page() {return <><ApprovedHealthPage pathname="/work"/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(healthPageSchema('Health Equity Initiative', '/work'))}} /></>;}
