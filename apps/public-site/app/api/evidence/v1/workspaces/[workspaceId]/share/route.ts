import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../../../lib/explore-workspace-auth";
import { createWorkspaceShareLink, requireCollaborationCapability } from "../../../../../../lib/explore-workspace-runtime";
import { isTrustedSameOrigin, publicSiteUrl, readBoundedText } from "../../../../../../lib/request-security";

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
    const scope = body.scope === "contributor" ? "contributor" : "read_only";
    const expiresInHours = typeof body.expiresInHours === "number" ? body.expiresInHours : undefined;
    const share = await createWorkspaceShareLink({ workspaceId, tenantId: actor.tenantId, actor, scope, expiresInHours });
    const { token, ...publicShare } = share;
    const url = publicSiteUrl(`/explore/share#token=${encodeURIComponent(token)}`).toString();
    return NextResponse.json(
      { contractVersion: "explore.workspace-share.v1", share: { ...publicShare, url } },
      { status: 201, headers: { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const unauthorized = /authorized|authenticated|tenant|participant/i.test(message);
    if (!unauthorized) {
      console.error("workspace-share-create-failed", { name: error instanceof Error ? error.name : "UnknownError" });
    }
    return NextResponse.json(
      { error: unauthorized ? "You are not authorized to share this workspace." : "The share link could not be created." },
      {
        status: unauthorized ? 403 : 503,
        headers: { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" },
      },
    );
  }
}
