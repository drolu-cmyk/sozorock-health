import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { placeAgentRuntimeVersions } from "../../../../lib/place-agent-openai";
import { requireWorkspaceActor } from "../../../../lib/explore-workspace-auth";
import {
  createCountyWorkspace,
  listCountyWorkspaces,
  requireCollaborationCapability,
} from "../../../../lib/explore-workspace-runtime";
import {
  isTrustedSameOrigin,
  readBoundedText,
} from "../../../../lib/request-security";

export const runtime = "nodejs";

function trusted(request: NextRequest) {
  const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
  return isTrustedSameOrigin(request, allowedHosts);
}

export async function GET(request: NextRequest) {
  try {
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const workspaces = await listCountyWorkspaces({ tenantId: actor.tenantId, actor });
    return NextResponse.json({ contractVersion: "explore.workspace-list.v1", actor: { displayName: actor.displayName, role: actor.role, access: actor.access }, workspaces }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!trusted(request)) {
      return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    }
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const bounded = await readBoundedText(request, 8_000, ["application/json"]);
    if (!bounded.ok) {
      return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    }
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const geoid = typeof body.geoid === "string" ? body.geoid.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const suppliedKey = request.headers.get("idempotency-key")?.trim();
    if (!/^\d{5}$/.test(geoid) || title.length < 3 || title.length > 240) {
      return NextResponse.json({ error: "Provide a valid county GEOID and workspace title." }, { status: 400 });
    }
    const workspace = await createCountyWorkspace({
      tenantId: actor.tenantId,
      geoid,
      title,
      actor,
      snapshotContentHash: placeAgentRuntimeVersions.snapshotContentHash,
      idempotencyKey: suppliedKey || randomUUID(),
    });
    return NextResponse.json({ contractVersion: "explore.workspace.v1", workspace }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = (error as Error).message;
    const status = /authenticated|authorized|assignment|tenant/i.test(message) ? 403 : 503;
    return NextResponse.json({ error: status === 403 ? message : "County workspace is temporarily unavailable." }, { status });
  }
}
