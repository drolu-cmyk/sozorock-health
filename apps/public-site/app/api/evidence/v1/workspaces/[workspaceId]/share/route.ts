import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../../../lib/explore-workspace-auth";
import { createWorkspaceShareLink, listWorkspaceShareLinks, requireCollaborationCapability, revokeWorkspaceShareLink } from "../../../../../../lib/explore-workspace-runtime";
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
    if (body.scope !== undefined && body.scope !== "read_only") {
      return NextResponse.json({ error: "Only read-only public share links are supported." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const scope = "read_only" as const;
    const expiresInHours = typeof body.expiresInHours === "number" ? body.expiresInHours : undefined;
    const share = await createWorkspaceShareLink({ workspaceId, tenantId: actor.tenantId, actor, scope, expiresInHours });
    return NextResponse.json({ contractVersion: "explore.workspace-share.v1", share }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: message }, { status: /authorized|authenticated|tenant|participant/i.test(message) ? 403 : 503 });
  }
}

export async function GET(request: NextRequest, context: Context) {
  try {
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const { workspaceId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return NextResponse.json({ error: "Workspace identifier is invalid." }, { status: 400 });
    const links = await listWorkspaceShareLinks({ workspaceId, tenantId: actor.tenantId, actor });
    return NextResponse.json({ contractVersion: "explore.workspace-share-list.v1", links }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: message }, { status: /authorized|authenticated|owner|participant/i.test(message) ? 403 : 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    if (!trusted(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const { workspaceId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return NextResponse.json({ error: "Workspace identifier is invalid." }, { status: 400 });
    const bounded = await readBoundedText(request, 2_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as { shareId?: unknown };
    if (typeof body.shareId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.shareId)) return NextResponse.json({ error: "Share identifier is invalid." }, { status: 400 });
    const revoked = await revokeWorkspaceShareLink({ workspaceId, tenantId: actor.tenantId, actor, shareId: body.shareId, idempotencyKey: request.headers.get("idempotency-key") ?? `share-revoke:${body.shareId}` });
    return NextResponse.json({ contractVersion: "explore.workspace-share-revoke.v1", revoked }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: message }, { status: /authorized|authenticated|owner|participant/i.test(message) ? 403 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
