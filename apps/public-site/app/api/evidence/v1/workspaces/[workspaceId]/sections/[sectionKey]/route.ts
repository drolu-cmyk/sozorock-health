import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../../../../lib/explore-workspace-auth";
import {
  requireCollaborationCapability,
  saveWorkspaceSection,
} from "../../../../../../../lib/explore-workspace-runtime";
import { isTrustedSameOrigin, readBoundedText } from "../../../../../../../lib/request-security";

export const runtime = "nodejs";
type Context = { params: Promise<{ workspaceId: string; sectionKey: string }> };

export async function PUT(request: NextRequest, context: Context) {
  try {
    const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
      .split(";").map((value) => value.trim()).filter(Boolean);
    if (!isTrustedSameOrigin(request, allowedHosts)) {
      return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    }
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const { workspaceId, sectionKey } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId) || !/^[a-z][a-z0-9_-]{1,63}$/.test(sectionKey)) {
      return NextResponse.json({ error: "Workspace or section identifier is invalid." }, { status: 400 });
    }
    const bounded = await readBoundedText(request, 64_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const expectedVersion = body.expectedVersion;
    const content = body.content;
    if (
      !Number.isSafeInteger(expectedVersion)
      || Number(expectedVersion) < 0
      || !content
      || typeof content !== "object"
      || Array.isArray(content)
    ) {
      return NextResponse.json({ error: "Provide a valid expected version and section content." }, { status: 400 });
    }
    const section = await saveWorkspaceSection({
      workspaceId,
      tenantId: actor.tenantId,
      actor,
      sectionKey,
      expectedVersion: Number(expectedVersion),
      content: content as Record<string, unknown>,
      idempotencyKey: request.headers.get("idempotency-key")?.trim() || randomUUID(),
    });
    return NextResponse.json({ contractVersion: "explore.workspace-section.v1", section }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = (error as Error).message;
    const status = (error as Error).name === "WorkspaceVersionConflict"
      ? 409
      : /authorized|authenticated|human|tenant/i.test(message) ? 403 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
