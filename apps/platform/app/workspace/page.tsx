import type { Metadata } from "next";
import { counties } from "../lib/server-data";
import { agenticRuntimeConfig } from "../lib/agentic-runtime";
import { PlanningRoom } from "./PlanningRoom";
export const metadata: Metadata = { title: "Planning Workspace | CB-CAP", robots: { index: false, follow: false }, alternates: { canonical: "/workspace" } };
export default function WorkspacePage() {
  return <PlanningRoom counties={agenticRuntimeConfig().enabled ? counties.map(({ fips, county, state, stateFips }) => ({ geoid: fips, name: county, state, stateFips })) : []} />;
}
