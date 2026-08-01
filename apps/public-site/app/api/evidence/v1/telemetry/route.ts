import { NextRequest, NextResponse } from "next/server";
import { recordExplorePerformance, recordExploreUsage } from "../../../../lib/explore-workspace-runtime";
import { enforceEvidenceRateLimit } from "../../../../lib/evidence-rate-limit";
import { evidenceRuntimeEnvironment } from "../../../../lib/evidence-runtime-authority";
import { isTrustedSameOrigin, readBoundedText } from "../../../../lib/request-security";
import type { EvidenceUsageEvent, PerformanceSample } from "@sozorock/evidence-core";

export const runtime = "nodejs";
const usageEvents = new Set<EvidenceUsageEvent["eventName"]>([
  "place_resolved", "brief_viewed", "map_viewed", "action_question_asked", "visuals_viewed",
  "workspace_created", "workspace_shared", "workspace_forked", "workspace_handoff_created",
  "funder_snapshot_exported", "pilot_onboarding_started", "pilot_onboarding_submitted", "source_correction_requested",
]);
const operations = new Set<PerformanceSample["operation"]>(["place_brief", "agent_response", "map_geometry", "workspace_event", "source_refresh"]);

function trusted(request: NextRequest) {
  const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
    .split(";").map((value) => value.trim()).filter(Boolean);
  return isTrustedSameOrigin(request, allowedHosts);
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(key)) continue;
    if (item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") output[key] = typeof item === "string" ? item.slice(0, 240) : item;
  }
  return output;
}

export async function POST(request: NextRequest) {
  try {
    if (!trusted(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    const limited = await enforceEvidenceRateLimit(request);
    if (!limited.allowed) return NextResponse.json({ error: "Telemetry rate limit reached." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter ?? 300) } });
    const bounded = await readBoundedText(request, 8_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const kind = body.kind === "performance" ? "performance" : "usage";
    const environment = evidenceRuntimeEnvironment();
    if (kind === "usage") {
      const eventName = typeof body.eventName === "string" && usageEvents.has(body.eventName as EvidenceUsageEvent["eventName"]) ? body.eventName as EvidenceUsageEvent["eventName"] : null;
      if (!eventName) return NextResponse.json({ error: "Unsupported telemetry event." }, { status: 400 });
      const occurredAt = typeof body.occurredAt === "string" && Number.isFinite(Date.parse(body.occurredAt)) ? body.occurredAt : new Date().toISOString();
      const event = await recordExploreUsage({
        eventName,
        geographyId: typeof body.geographyId === "string" && /^[0-9a-f-]{36}$/i.test(body.geographyId) ? body.geographyId : null,
        workspaceId: typeof body.workspaceId === "string" && /^[0-9a-f-]{36}$/i.test(body.workspaceId) ? body.workspaceId : null,
        sessionIdHash: typeof body.sessionIdHash === "string" && /^sha256:[0-9a-f]{64}$/.test(body.sessionIdHash) ? body.sessionIdHash : null,
        environment,
        occurredAt,
        metadata: safeMetadata(body.metadata),
      });
      return NextResponse.json({ contractVersion: "explore.telemetry.v1", recorded: true, retentionUntil: event.retentionUntil }, { status: 202, headers: { "Cache-Control": "no-store" } });
    }
    const operation = typeof body.operation === "string" && operations.has(body.operation as PerformanceSample["operation"]) ? body.operation as PerformanceSample["operation"] : null;
    if (!operation) return NextResponse.json({ error: "Unsupported performance operation." }, { status: 400 });
    const sample = await recordExplorePerformance({
      operation,
      environment,
      latencyMs: typeof body.latencyMs === "number" ? body.latencyMs : -1,
      success: body.success === true,
      errorClass: typeof body.errorClass === "string" ? body.errorClass.slice(0, 120) : null,
      estimatedCostMicros: typeof body.estimatedCostMicros === "number" ? body.estimatedCostMicros : null,
      inputTokens: typeof body.inputTokens === "number" ? body.inputTokens : null,
      outputTokens: typeof body.outputTokens === "number" ? body.outputTokens : null,
      correctionRequired: body.correctionRequired === true,
      occurredAt: typeof body.occurredAt === "string" && Number.isFinite(Date.parse(body.occurredAt)) ? body.occurredAt : new Date().toISOString(),
    });
    return NextResponse.json({ contractVersion: "explore.telemetry.v1", recorded: true, latencyMs: sample.latencyMs }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Telemetry must never break the public Explore experience.  The request
    // is acknowledged only when persisted; otherwise the client can discard
    // it and continue without exposing operational details.
    return NextResponse.json({ error: "Telemetry unavailable." }, { status: 202, headers: { "Cache-Control": "no-store" } });
  }
}
