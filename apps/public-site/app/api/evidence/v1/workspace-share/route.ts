import { NextRequest, NextResponse } from "next/server";
import { readWorkspaceShareLink } from "../../../../lib/explore-workspace-runtime";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  try {
    const share = await readWorkspaceShareLink({ token });
    return NextResponse.json({ contractVersion: "explore.workspace-share-read.v1", share }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "This share link is invalid, expired, or revoked." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
