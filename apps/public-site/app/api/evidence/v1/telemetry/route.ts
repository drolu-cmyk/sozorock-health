import { NextRequest, NextResponse } from "next/server";
import { recordExploreUsage } from "../../../../lib/explore-workspace-runtime";
import { enforceEvidenceRateLimit } from "../../../../lib/evidence-rate-limit";
import { evidenceRuntimeEnvironment } from "../../../../lib/evidence-runtime-authority";
import { isTrustedSameOrigin, readBoundedText } from "../../../../lib/request-security";
import type { EvidenceUsageEvent } from "@sozorock/evidence-core";

export const runtime = "nodejs";
const usageEvents = new Set<EvidenceUsageEvent["eventName"]>([
  "place_resolved", "brief_viewed", "map_viewed", "action_question_asked", "visuals_viewed",
]);

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
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bounded.text) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "The request body was not valid JSON." }, { status: 400 });
    }
    const kind = body.kind === "performance" ? "performance" : "usage";
    const environment = evidenceRuntimeEnvironment();
    if (kind === "performance") {
      return NextResponse.json({ error: "Performance telemetry is server-generated." }, { status: 403 });
    }
    if (kind === "usage") {
      const eventName = typeof body.eventName === "string" && usageEvents.has(body.eventName as EvidenceUsageEvent["eventName"]) ? body.eventName as EvidenceUsageEvent["eventName"] : null;
      if (!eventName) return NextResponse.json({ error: "Unsupported telemetry event." }, { status: 400 });
      const event = await recordExploreUsage({
        eventName,
        geographyId: null,
        workspaceId: null,
        sessionIdHash: null,
        environment,
        occurredAt: new Date().toISOString(),
        metadata: safeMetadata(body.metadata),
      });
      return NextResponse.json({ contractVersion: "explore.telemetry.v1", recorded: true, retentionUntil: event.retentionUntil }, { status: 202, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Unsupported telemetry event." }, { status: 400 });
  } catch {
    // Telemetry must never break the public Explore experience.  The request
    // is acknowledged only when persisted; otherwise the client can discard
    // it and continue without exposing operational details.
    return NextResponse.json({ error: "Telemetry unavailable." }, { status: 202, headers: { "Cache-Control": "no-store" } });
  }
}
