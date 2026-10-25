export const dynamic = "force-static";
export const revalidate = 3600;

import { ApprovedHealthPage } from "./components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "./lib/health-metadata";
export const metadata = {...healthMetadata('Health Access for Every ZIP Code', 'Care is too few, too far and too hard to reach. SozoRock Health helps change all three with Health Equity Hubs, Health Access Day, sponsored primary care and free county health data. All care is delivered by licensed providers.', '/'), alternates:{canonical:'/',languages:{'en-US':'/','es-US':'/es'}}};
export default function Page() {return <><ApprovedHealthPage pathname="/"/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(healthPageSchema('Health Access for Every ZIP Code', '/'))}} /></>;}
