"use client";
import Link from "next/link";
import { useState } from "react";
import { CountyPreview, type CountyChoice } from "../CountyPreview";
import { AgenticWorkspace } from "../components/AgenticWorkspace";
import type { GeographyProfile } from "../lib/types";
export function PlanningRoom({ counties }: { counties: CountyChoice[] }) {
  const [profile, setProfile] = useState<GeographyProfile | null>(null);
  return <div className="cb-workspace"><header className="cb-top"><Link href="/" className="cb-wordmark">CB-CAP<span>Planning Workspace</span></Link><Link href="/">Public Evidence Preview</Link></header><main><h1>Start with your county.</h1><p>Select the county whose evidence belongs in your plan.</p><CountyPreview counties={counties} onCounty={setProfile} /><AgenticWorkspace profile={profile} /></main></div>;
}
