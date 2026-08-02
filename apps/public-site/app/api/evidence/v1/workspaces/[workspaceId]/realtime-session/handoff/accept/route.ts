import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../../../../../lib/explore-workspace-auth";
import { requireCollaborationCapability, requireWorkspaceMembership } from "../../../../../../../../lib/explore-workspace-runtime";
import { acceptRealtimeHandoff } from "../../../../../../../../lib/explore-realtime";
import { isTrustedSameOrigin, readBoundedText } from "../../../../../../../../lib/request-security";

export const runtime = "nodejs";
type Context = { params: Promise<{ workspaceId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
      .split(";").map((value) => value.trim()).filter(Boolean);
    if (!isTrustedSameOrigin(request, allowedHosts)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const { workspaceId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return NextResponse.json({ error: "Workspace identifier is invalid." }, { status: 400 });
    // A bearer handoff token never grants workspace access by itself.  The
    // accepting identity must already be an active participant in the same
    // tenant and workspace before a realtime session is minted.
    await requireWorkspaceMembership({ workspaceId, tenantId: actor.tenantId, actor });
    const bounded = await readBoundedText(request, 2_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token : "";
    if (token.length < 32 || token.length > 160) return NextResponse.json({ error: "Provide a valid handoff token." }, { status: 400 });
    const session = await acceptRealtimeHandoff({ token, workspaceId, tenantId: actor.tenantId, actor });
    return NextResponse.json({ contractVersion: "explore.realtime-handoff-accept.v1", session }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: message }, { status: /authorized|authenticated|tenant|workspace/i.test(message) ? 403 : 503 });
  }
}
