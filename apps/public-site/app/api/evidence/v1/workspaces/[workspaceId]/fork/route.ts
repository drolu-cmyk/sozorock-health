import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireWorkspaceActor } from "../../../../../../lib/explore-workspace-auth";
import { forkCountyWorkspace, requireCollaborationCapability } from "../../../../../../lib/explore-workspace-runtime";
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
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 240) : "";
    if (title.length < 3) return NextResponse.json({ error: "Provide a name for the forked county plan." }, { status: 400 });
    const fork = await forkCountyWorkspace({
      workspaceId,
      tenantId: actor.tenantId,
      actor,
      title,
      idempotencyKey: request.headers.get("idempotency-key")?.trim() || randomUUID(),
    });
    return NextResponse.json({ contractVersion: "explore.workspace-fork.v1", ...fork }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const unauthorized = /authorized|authenticated|tenant|participant/i.test(message);
    if (!unauthorized) {
      console.error("workspace-fork-failed", { name: error instanceof Error ? error.name : "UnknownError" });
    }
    return NextResponse.json(
      { error: unauthorized ? "You are not authorized to fork this workspace." : "The workspace could not be forked." },
      {
        status: unauthorized ? 403 : 503,
        headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
      },
    );
  }
}
