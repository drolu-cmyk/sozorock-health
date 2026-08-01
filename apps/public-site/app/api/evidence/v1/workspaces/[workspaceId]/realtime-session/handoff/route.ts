import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../../../../lib/explore-workspace-auth";
import { requireCollaborationCapability, requireWorkspaceMembership } from "../../../../../../../lib/explore-workspace-runtime";
import { mintRealtimeHandoff } from "../../../../../../../lib/explore-realtime";
import { isTrustedSameOrigin, readBoundedText } from "../../../../../../../lib/request-security";

export const runtime = "nodejs";
type Context = { params: Promise<{ workspaceId: string }> };

function trusted(request: NextRequest) {
  const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
    .split(";").map((value) => value.trim()).filter(Boolean);
  return isTrustedSameOrigin(request, allowedHosts);
}

export async function POST(request: NextRequest, context: Context) {
  try {
    if (!trusted(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const { workspaceId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return NextResponse.json({ error: "Workspace identifier is invalid." }, { status: 400 });
    await requireWorkspaceMembership({ workspaceId, tenantId: actor.tenantId, actor });
    const bounded = await readBoundedText(request, 2_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const handoff = await mintRealtimeHandoff({ workspaceId, tenantId: actor.tenantId, actor, sessionId });
    return NextResponse.json({ contractVersion: "explore.realtime-handoff.v1", handoff }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: message }, { status: /authorized|authenticated|tenant|participant/i.test(message) ? 403 : 503 });
  }
}
