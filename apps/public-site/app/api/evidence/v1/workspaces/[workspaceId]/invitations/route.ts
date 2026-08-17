import { NextRequest, NextResponse } from "next/server";
import type { WorkspaceAccess, WorkspaceRole } from "@sozorock/evidence-core";
import { requireWorkspaceActor } from "../../../../../../lib/explore-workspace-auth";
import {
  createWorkspaceInvitation,
  requireCollaborationCapability,
} from "../../../../../../lib/explore-workspace-runtime";
import { isTrustedSameOrigin, readBoundedText } from "../../../../../../lib/request-security";

export const runtime = "nodejs";
type Context = { params: Promise<{ workspaceId: string }> };
const roles = new Set<WorkspaceRole>([
  "foundation_reviewer",
  "county_planner",
  "community_partner",
  "research_funder_viewer",
]);
const accessLevels = new Set<WorkspaceAccess>(["contributor", "viewer"]);

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
    const bounded = await readBoundedText(request, 4_000, ["application/json"]);
    if (!bounded.ok || !/^[0-9a-f-]{36}$/i.test(workspaceId)) {
      return NextResponse.json({ error: "The invitation request is invalid." }, { status: 400 });
    }
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const role = body.role as WorkspaceRole;
    const access = body.access as WorkspaceAccess;
    const intendedPrincipalId = typeof body.intendedPrincipalId === "string"
      && /^[^\u0000-\u001f\u007f]{1,200}$/.test(body.intendedPrincipalId.trim())
      ? body.intendedPrincipalId.trim()
      : undefined;
    if (!roles.has(role) || !accessLevels.has(access)) {
      return NextResponse.json({ error: "Choose an approved workspace role and access level." }, { status: 400 });
    }
    const invitation = await createWorkspaceInvitation({
      workspaceId,
      tenantId: actor.tenantId,
      actor,
      role: role as Exclude<WorkspaceRole, "evidence_agent">,
      access: access as Exclude<WorkspaceAccess, "owner">,
      intendedPrincipalId,
    });
    return NextResponse.json({ contractVersion: "explore.workspace-invitation.v1", invitation }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const unauthorized = /authorized|authenticated|tenant|participant/i.test(message);
    if (!unauthorized) {
      console.error("workspace-invitation-failed", { name: error instanceof Error ? error.name : "UnknownError" });
    }
    return NextResponse.json(
      { error: unauthorized ? "You are not authorized to invite participants to this workspace." : "The workspace invitation could not be created." },
      {
        status: unauthorized ? 403 : 503,
        headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
      },
    );
  }
}
