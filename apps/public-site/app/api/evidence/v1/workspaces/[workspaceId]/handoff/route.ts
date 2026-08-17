import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../../../lib/explore-workspace-auth";
import { createWorkspaceHandoff, requireCollaborationCapability } from "../../../../../../lib/explore-workspace-runtime";
import { isTrustedSameOrigin, readBoundedText } from "../../../../../../lib/request-security";

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
    const bounded = await readBoundedText(request, 4_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const roles = new Set(["county_planner", "community_partner", "research_funder_viewer", "foundation_reviewer"]);
    const targetRole = typeof body.targetRole === "string" && roles.has(body.targetRole)
      ? body.targetRole as "county_planner" | "community_partner" | "research_funder_viewer" | "foundation_reviewer"
      : "community_partner";
    const expiresInHours = typeof body.expiresInHours === "number" ? body.expiresInHours : undefined;
    const targetPrincipalId = typeof body.targetPrincipalId === "string"
      && /^[^\u0000-\u001f\u007f]{1,200}$/.test(body.targetPrincipalId.trim())
      ? body.targetPrincipalId.trim()
      : undefined;
    const handoff = await createWorkspaceHandoff({ workspaceId, tenantId: actor.tenantId, actor, targetRole, targetPrincipalId, expiresInHours });
    return NextResponse.json({ contractVersion: "explore.workspace-handoff.v1", handoff }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const unauthorized = /authorized|authenticated|tenant|participant/i.test(message);
    if (!unauthorized) {
      console.error("workspace-handoff-failed", { name: error instanceof Error ? error.name : "UnknownError" });
    }
    return NextResponse.json(
      { error: unauthorized ? "You are not authorized to create this handoff." : "The workspace handoff could not be created." },
      {
        status: unauthorized ? 403 : 503,
        headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
      },
    );
  }
}
