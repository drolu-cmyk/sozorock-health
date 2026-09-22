import { ApprovedHealthPage } from "../components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
export const metadata = healthMetadata('County health data and CB-CAP', 'Explore county health and community data, workforce information, source dates and definitions through Place Intelligence and CB-CAP.', '/evidence');
export default function Page() {return <><ApprovedHealthPage pathname="/evidence"/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(healthPageSchema('County health data and CB-CAP', '/evidence'))}} /></>;}
