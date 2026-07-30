import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../../lib/explore-workspace-auth";
import {
  acceptWorkspaceInvitation,
  requireCollaborationCapability,
} from "../../../../../lib/explore-workspace-runtime";
import { isTrustedSameOrigin, readBoundedText } from "../../../../../lib/request-security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
      .split(";").map((value) => value.trim()).filter(Boolean);
    if (!isTrustedSameOrigin(request, allowedHosts)) {
      return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    }
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const bounded = await readBoundedText(request, 4_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The invitation request is invalid." }, { status: 400 });
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) {
      return NextResponse.json({ error: "The invitation token is invalid." }, { status: 400 });
    }
    const accepted = await acceptWorkspaceInvitation({
      token,
      tenantId: actor.tenantId,
      actor,
      idempotencyKey: request.headers.get("idempotency-key")?.trim() || randomUUID(),
    });
    return NextResponse.json({ contractVersion: "explore.workspace-invitation-acceptance.v1", accepted }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 });
  }
}
