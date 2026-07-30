import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../../../lib/explore-workspace-auth";
import {
  requireCollaborationCapability,
  requireWorkspaceMembership,
} from "../../../../../../lib/explore-workspace-runtime";
import { mintRealtimeSession } from "../../../../../../lib/explore-realtime";
import { isTrustedSameOrigin } from "../../../../../../lib/request-security";

export const runtime = "nodejs";
type Context = { params: Promise<{ workspaceId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
      .split(";").map((value) => value.trim()).filter(Boolean);
    if (!isTrustedSameOrigin(request, allowedHosts)) {
      return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    }
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const { workspaceId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
      return NextResponse.json({ error: "Workspace identifier is invalid." }, { status: 400 });
    }
    await requireWorkspaceMembership({
      workspaceId,
      tenantId: actor.tenantId,
      actor,
    });
    const session = await mintRealtimeSession({
      workspaceId,
      tenantId: actor.tenantId,
      actor,
    });
    return NextResponse.json({ contractVersion: "explore.realtime-session.v1", session }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 });
  }
}
