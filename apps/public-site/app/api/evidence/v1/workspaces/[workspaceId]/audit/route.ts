import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../../../lib/explore-workspace-auth";
import { getWorkspaceAudit, requireCollaborationCapability } from "../../../../../../lib/explore-workspace-runtime";

export const runtime = "nodejs";
type Context = { params: Promise<{ workspaceId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const { workspaceId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return NextResponse.json({ error: "Workspace identifier is invalid." }, { status: 400 });
    const audit = await getWorkspaceAudit({ workspaceId, tenantId: actor.tenantId, actor });
    return NextResponse.json({ contractVersion: "explore.workspace-audit.v1", audit }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: message }, { status: /authorized|authenticated|owner|reviewer|participant/i.test(message) ? 403 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
