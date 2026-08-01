import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireWorkspaceActor } from "../../../../../lib/explore-workspace-auth";
import { acceptWorkspaceHandoff, requireCollaborationCapability } from "../../../../../lib/explore-workspace-runtime";
import { isTrustedSameOrigin, readBoundedText } from "../../../../../lib/request-security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
      .split(";").map((value) => value.trim()).filter(Boolean);
    if (!isTrustedSameOrigin(request, allowedHosts)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const bounded = await readBoundedText(request, 4_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 32) return NextResponse.json({ error: "Provide a valid handoff token." }, { status: 400 });
    const result = await acceptWorkspaceHandoff({
      token,
      tenantId: actor.tenantId,
      actor,
      idempotencyKey: request.headers.get("idempotency-key")?.trim() || randomUUID(),
    });
    return NextResponse.json({ contractVersion: "explore.workspace-handoff-accept.v1", ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: message }, { status: /authorized|authenticated|tenant|participant/i.test(message) ? 403 : 503 });
  }
}
