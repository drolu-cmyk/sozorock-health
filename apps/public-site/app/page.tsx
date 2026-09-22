import { ApprovedHealthPage } from "./components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "./lib/health-metadata";
export const metadata = {...healthMetadata('Health equity and primary care access', 'Health Equity Hubs, digital readiness, county evidence and the planned 25-person New York primary-care pilot.', '/'), alternates:{canonical:'/',languages:{'en-US':'/','es-US':'/es'}}};
export default function Page() {return <><ApprovedHealthPage pathname="/"/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(healthPageSchema('Health equity and primary care access', '/'))}} /></>;}
