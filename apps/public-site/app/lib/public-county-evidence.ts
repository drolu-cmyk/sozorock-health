import { publicCountyMeasures, type PublicCountyGroup } from "./public-county-measures.ts";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

export type PublicEstimate = { value: number | null; ci: number[] | null };
type County = { fips: string; stateFips: string; state: string; stateCode: string; county: string } & Record<PublicCountyGroup, Record<string, PublicEstimate>>;
const require = createRequire(import.meta.url);
const manifest = require("../../../platform/data/source-manifest.json") as {quality:{sha256:string};indicators:{source:string;url:string;released:string;modeledEstimateNotice:string}};
const counties = require("../../../platform/data/county-planning.json") as County[];
// Verify the parsed snapshot as well as retaining the original byte hash in source metadata.
// The canonical representation survives Next.js bundling without runtime file-path assumptions.
if (createHash("sha256").update(JSON.stringify(counties)).digest("hex") !== "0b211b3e4f6700251c77603c39c6d7b74a05c930edcaa66f96a5fa3acc24410a") throw new Error("Public county evidence integrity check failed.");
if (counties.length !== 3144 || new Set(counties.map(c=>c.fips)).size !== 3144) throw new Error("Public county evidence coverage check failed.");
const byFips = new Map(counties.map(c=>[c.fips,c]));
export const publicCountyChoices = counties.map(c=>({fips:c.fips,name:c.county,state:c.state,stateFips:c.stateFips}));
export const publicCountySource = {...manifest.indicators,contentHash:manifest.quality.sha256};
export function publicCountyEvidence(fips: string) {
  const county=byFips.get(fips);
  if (!county) return null;
  const group=(name: PublicCountyGroup)=>Object.fromEntries(publicCountyMeasures.filter(m=>m.group===name).map(m=>[m.key,county[name][m.key]??{value:null,ci:null}]));
  return {fips:county.fips,name:county.county,state:county.state,stateCode:county.stateCode,conditions:group("conditions"),barriers:group("barriers"),prevention:group("prevention")};
}
export type PublicCountyEvidence = NonNullable<ReturnType<typeof publicCountyEvidence>>;
