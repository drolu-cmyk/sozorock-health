import { NextResponse } from "next/server";
import { placeAgentRuntimeVersions } from "../../../lib/place-agent-openai";
export const dynamic = "force-dynamic";
export function GET() {
  const candidate=process.env.HEALTH_RELEASE_SHA ?? "";
  return NextResponse.json({
    service:"sozorock-health-public",
    commit:/^[a-f0-9]{40}$/.test(candidate) ? candidate : null,
    snapshotContentHash:placeAgentRuntimeVersions.snapshotContentHash,
  },{headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex"}});
}
