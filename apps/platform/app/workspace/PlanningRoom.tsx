"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CountyPreview, type CountyChoice } from "../CountyPreview";
import { AgenticWorkspace } from "../components/AgenticWorkspace";
import { agenticRuntimeConfig } from "../lib/agentic-runtime";
import type { GeographyProfile } from "../lib/types";
export function PlanningRoom({ counties }: { counties: CountyChoice[] }) {
  const configured = useMemo(() => agenticRuntimeConfig().enabled, []);
  const [profile, setProfile] = useState<GeographyProfile | null>(null);
  return <div className="cb-workspace"><header className="cb-top"><Link href="/" className="cb-wordmark">CB-CAP<span>Planning Workspace</span></Link><Link href="/">Public Evidence Preview</Link></header><main><h1>{configured ? "Start with your county." : "Planning Workspace"}</h1>{configured && <><p>Select the county whose evidence belongs in your plan.</p><CountyPreview counties={counties} onCounty={setProfile} /></>}<AgenticWorkspace profile={profile} /></main></div>;
}
