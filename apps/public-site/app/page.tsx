export const dynamic = "force-static";
export const revalidate = 3600;

import { ApprovedHealthPage } from "./components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "./lib/health-metadata";
export const metadata = {...healthMetadata('Health Access in New York', 'SozoRock Health closes the distance between people and care: Health Equity Hubs in trusted local places, free county health evidence, secure digital health and the Primary Care Access Program for up to 25 New Yorkers from January 2027.', '/'), alternates:{canonical:'/',languages:{'en-US':'/','es-US':'/es'}}};
export default function Page() {return <><ApprovedHealthPage pathname="/"/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(healthPageSchema('Health Access in New York', '/'))}} /></>;}
