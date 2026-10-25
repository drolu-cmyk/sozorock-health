export const dynamic = "force-static";
export const revalidate = 3600;

import { ApprovedHealthPage } from "../components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "../lib/health-metadata";
export const metadata = healthMetadata('Free County Health Data and Maps', 'Free health, community and workforce data for U.S. counties, with every source, date and definition. Explore Place Intelligence and CB-CAP county planning.', '/evidence');
export default function Page() {return <><ApprovedHealthPage pathname="/evidence"/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(healthPageSchema('Free County Health Data and Maps', '/evidence'))}} /></>;}
