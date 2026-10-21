import { ApprovedHealthPage } from "./components/ApprovedHealthPages";
import { healthMetadata, healthPageSchema } from "./lib/health-metadata";
export const metadata = {...healthMetadata('Primary Care Access in New York', 'SozoRock Health: the Primary Care Access Program for up to 25 New Yorkers from January 2027, proposed Health Equity Hubs and county health evidence.', '/'), alternates:{canonical:'/',languages:{'en-US':'/','es-US':'/es'}}};
export default function Page() {return <><ApprovedHealthPage pathname="/"/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(healthPageSchema('Primary Care Access in New York', '/'))}} /></>;}
