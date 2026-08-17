import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../../../../lib/explore-workspace-auth";
import {
  requireCollaborationCapability,
  saveWorkspaceSection,
} from "../../../../../../../lib/explore-workspace-runtime";
import { isBoundedJsonValue, isTrustedSameOrigin, readBoundedText } from "../../../../../../../lib/request-security";

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
      || !isBoundedJsonValue(content, {
        maxDepth: 8,
        maxNodes: 1_000,
        maxObjectKeys: 80,
        maxArrayLength: 80,
        maxStringLength: 4_000,
      })
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
    const message = error instanceof Error ? error.message : "";
    const name = error instanceof Error ? error.name : "UnknownError";
    const conflict = name === "WorkspaceVersionConflict";
    const unauthorized = /authorized|authenticated|human|tenant|participant/i.test(message);
    if (!conflict && !unauthorized) {
      console.error("workspace-section-save-failed", { name });
    }
    const status = conflict ? 409 : unauthorized ? 403 : 503;
    const publicMessage = conflict
      ? "This section changed before your update could be saved. Refresh and try again."
      : unauthorized
        ? "You are not authorized to update this workspace section."
        : "The workspace section could not be saved.";
    return NextResponse.json(
      { error: publicMessage },
      {
        status,
        headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
      },
    );
  }
}
