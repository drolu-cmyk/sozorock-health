import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  WORKSPACE_EVENT_TYPES,
  eventRequiresHumanAcceptance,
  type WorkspaceEventType,
} from "@sozorock/evidence-core";
import { requireWorkspaceActor } from "../../../../../../lib/explore-workspace-auth";
import {
  appendWorkspaceEvent,
  listWorkspaceEvents,
  requireCollaborationCapability,
} from "../../../../../../lib/explore-workspace-runtime";
import {
  isTrustedSameOrigin,
  readBoundedText,
} from "../../../../../../lib/request-security";
import { broadcastWorkspaceEvent } from "../../../../../../lib/explore-realtime";

export const runtime = "nodejs";

type Context = { params: Promise<{ workspaceId: string }> };
const eventTypes = new Set<WorkspaceEventType>(WORKSPACE_EVENT_TYPES);

function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function trusted(request: NextRequest) {
  const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
  return isTrustedSameOrigin(request, allowedHosts);
}

function protectedError(error: unknown, unavailableMessage: string) {
  const message = error instanceof Error ? error.message : "";
  const unauthorized = /authorized|authenticated|tenant|participant/i.test(message);
  console.error("workspace-events-request-failed", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  return NextResponse.json(
    { error: unauthorized ? "You are not authorized to access this workspace." : unavailableMessage },
    {
      status: unauthorized ? 403 : 503,
      headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
    },
  );
}

export async function GET(request: NextRequest, context: Context) {
  try {
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const { workspaceId } = await context.params;
    if (!uuid(workspaceId)) return NextResponse.json({ error: "Workspace identifier is invalid." }, { status: 400 });
    const after = Number(request.nextUrl.searchParams.get("after") ?? "0");
    if (!Number.isSafeInteger(after) || after < 0) {
      return NextResponse.json({ error: "Event sequence is invalid." }, { status: 400 });
    }
    const events = await listWorkspaceEvents({
      workspaceId,
      tenantId: actor.tenantId,
      actor,
      afterSequence: after,
    });
    return NextResponse.json({ contractVersion: "explore.workspace-events.v1", events }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return protectedError(error, "Workspace events could not be loaded.");
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    if (!trusted(request)) {
      return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    }
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const { workspaceId } = await context.params;
    if (!uuid(workspaceId)) return NextResponse.json({ error: "Workspace identifier is invalid." }, { status: 400 });
    const bounded = await readBoundedText(request, 32_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const eventType = body.eventType as WorkspaceEventType;
    const payload = body.payload;
    if (!eventTypes.has(eventType) || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Provide an approved event type and object payload." }, { status: 400 });
    }
    if (
      actor.actorType === "agent"
      && (eventRequiresHumanAcceptance(eventType) || eventType === "workspace_archived")
    ) {
      return NextResponse.json({ error: "This action requires an authorized human participant." }, { status: 403 });
    }
    const event = await appendWorkspaceEvent({
      workspaceId,
      tenantId: actor.tenantId,
      eventType,
      actor,
      idempotencyKey: request.headers.get("idempotency-key")?.trim() || randomUUID(),
      evidenceSnapshotId: typeof body.evidenceSnapshotId === "string" ? body.evidenceSnapshotId : null,
      payload: payload as Record<string, unknown>,
      modelVersion: typeof body.modelVersion === "string" ? body.modelVersion : null,
      promptVersion: typeof body.promptVersion === "string" ? body.promptVersion : null,
      toolName: typeof body.toolName === "string" ? body.toolName : null,
      requestHash: typeof body.requestHash === "string" ? body.requestHash : null,
      responseHash: typeof body.responseHash === "string" ? body.responseHash : null,
      outcome: "recorded",
    });
    let realtimeDelivery: "sent" | "poll_required" = "sent";
    try {
      if (event.inserted) await broadcastWorkspaceEvent(workspaceId, event);
    } catch (error) {
      realtimeDelivery = "poll_required";
      console.error("workspace-realtime-broadcast-failed", {
        workspaceId,
        name: (error as { name?: string }).name ?? "UnknownError",
      });
    }
    return NextResponse.json({ contractVersion: "explore.workspace-event.v1", event, realtimeDelivery }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return protectedError(error, "The workspace event could not be recorded.");
  }
}
