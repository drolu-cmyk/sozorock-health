import { PublicProduct } from "./PublicProduct";
import { counties } from "./lib/server-data";

export default function PlatformPage() {
  const choices = counties.map(({ fips, county, state, stateFips }) => ({ geoid: fips, name: county, state, stateFips }));
  return <PublicProduct counties={choices} />;
}
