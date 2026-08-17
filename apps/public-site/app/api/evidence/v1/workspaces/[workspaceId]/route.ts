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
    const message = error instanceof Error ? error.message : "";
    const unauthorized = /authorized|authenticated|tenant|participant/i.test(message);
    console.error("workspace-plan-read-failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: unauthorized ? "You are not authorized to access this workspace." : "The workspace could not be loaded." },
      {
        status: unauthorized ? 403 : 503,
        headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
      },
    );
  }
}
