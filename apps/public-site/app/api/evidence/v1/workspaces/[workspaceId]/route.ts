import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../../lib/explore-workspace-auth";
import {
  getWorkspacePlan,
  requireCollaborationCapability,
} from "../../../../../lib/explore-workspace-runtime";

export const runtime = "nodejs";
type Context = { params: Promise<{ workspaceId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const { workspaceId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
      return NextResponse.json({ error: "Workspace identifier is invalid." }, { status: 400 });
    }
    const plan = await getWorkspacePlan({
      workspaceId,
      tenantId: actor.tenantId,
      actor,
    });
    return NextResponse.json({ contractVersion: "explore.workspace-plan.v1", ...plan }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 });
  }
}
