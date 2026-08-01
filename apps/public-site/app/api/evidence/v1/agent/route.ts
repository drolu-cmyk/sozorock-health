import { NextRequest, NextResponse } from "next/server";
import { enforceAgentRateLimit } from "../../../../lib/evidence-rate-limit";
import {
  requireEvidenceAuthority,
  requireEvidenceGeographyId,
  evidenceRuntimeEnvironment,
  sha256,
  writeExecutionAudit,
} from "../../../../lib/evidence-runtime-authority";
import { recordExplorePerformance } from "../../../../lib/explore-workspace-runtime";
import {
  placeAgentRuntimeVersions,
} from "../../../../lib/place-agent-openai";
import { configuredPlaceNarrativeProvider } from "../../../../lib/place-agent-provider";
import {
  isTrustedSameOrigin,
  readBoundedText,
} from "../../../../lib/request-security";

export const runtime = "nodejs";

function validInput(value: unknown): value is { geoid: string; question: string } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.geoid === "string"
    && /^\d{5}$/.test(input.geoid)
    && typeof input.question === "string"
    && input.question.trim().length >= 3
    && input.question.trim().length <= 1_500;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let authority: Awaited<ReturnType<typeof requireEvidenceAuthority>> | null = null;
  let requestHash = sha256("unparsed");
  let geographyUuid: string | null = null;
  try {
    const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!isTrustedSameOrigin(request, allowedHosts)) {
      return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    }
    const rate = await enforceAgentRateLimit(request);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: rate.retryAfter ? "Please wait before asking another place-evidence question." : "Place Intelligence is unavailable." },
        { status: rate.retryAfter ? 429 : 503, headers: rate.retryAfter ? { "Retry-After": String(rate.retryAfter) } : undefined },
      );
    }
    const bounded = await readBoundedText(request, 24_000, ["application/json"]);
    if (!bounded.ok) {
      return NextResponse.json(
        { error: bounded.error === "unsupported-media-type" ? "Send JSON." : "The request was too large." },
        { status: bounded.error === "unsupported-media-type" ? 415 : 413 },
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(bounded.text);
    } catch {
      return NextResponse.json({ error: "The request body was not valid JSON." }, { status: 400 });
    }
    if (!validInput(body)) {
      return NextResponse.json({ error: "Provide a valid five-digit county GEOID and a question." }, { status: 400 });
    }
    requestHash = sha256({ geoid: body.geoid, question: body.question.trim() });
    authority = await requireEvidenceAuthority(placeAgentRuntimeVersions.snapshotContentHash);
    geographyUuid = await requireEvidenceGeographyId(body.geoid);
    if (!authority.narrativeEnabled || !authority.openAiEnabled) {
      await writeExecutionAudit({
        executionType: "internal_agent",
        contractVersion: "explore.place-agent.v1",
        policyVersion: placeAgentRuntimeVersions.policyVersion,
        snapshotUuid: authority.snapshotUuid,
        geographyUuid,
        requestHash,
        responseHash: null,
        outcome: "rejected",
        reason: "Agent capability switch is disabled.",
        metadata: { geoid: body.geoid },
      });
      return NextResponse.json({ error: "Place Intelligence is not currently enabled." }, { status: 503 });
    }
    const provider = configuredPlaceNarrativeProvider();
    const output = await provider.generate({ geoid: body.geoid, question: body.question.trim() });
    await writeExecutionAudit({
      executionType: "internal_agent",
      contractVersion: "explore.place-agent.v1",
      policyVersion: placeAgentRuntimeVersions.policyVersion,
      snapshotUuid: authority.snapshotUuid,
      geographyUuid,
      requestHash,
      responseHash: `sha256:${output.outputHash}`,
      outcome: output.answer.status === "refused" ? "rejected" : "succeeded",
      reason: output.answer.status,
      metadata: {
        geoid: body.geoid,
        model: output.model,
        provider: provider.id,
        responseId: output.responseId,
        schemaVersion: placeAgentRuntimeVersions.schemaVersion,
        snapshotContentHash: output.snapshotContentHash,
        toolCalls: output.toolCalls,
        pipelineSteps: output.pipelineSteps,
        usage: output.usage ?? null,
      },
    });
    try {
      await recordExplorePerformance({
        operation: "agent_response",
        environment: evidenceRuntimeEnvironment(),
        latencyMs: Date.now() - startedAt,
        success: true,
        errorClass: null,
        estimatedCostMicros: null,
        inputTokens: output.usage?.input_tokens ?? null,
        outputTokens: output.usage?.output_tokens ?? null,
        correctionRequired: false,
        occurredAt: new Date().toISOString(),
      });
    } catch {
      console.error("place-evidence-agent-performance-audit-failed");
    }
    return NextResponse.json(output.answer, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("place-evidence-agent-failed", {
      name: (error as { name?: string }).name ?? "UnknownError",
    });
    if (authority) {
      try {
        await writeExecutionAudit({
          executionType: "internal_agent",
          contractVersion: "explore.place-agent.v1",
          policyVersion: placeAgentRuntimeVersions.policyVersion,
          snapshotUuid: authority.snapshotUuid,
          geographyUuid,
          requestHash,
          responseHash: null,
          outcome: "failed",
          reason: (error as Error).message,
          metadata: { errorName: (error as { name?: string }).name ?? "UnknownError" },
        });
      } catch {
        console.error("place-evidence-agent-audit-failed");
      }
      try {
        await recordExplorePerformance({
          operation: "agent_response",
          environment: evidenceRuntimeEnvironment(),
          latencyMs: Date.now() - startedAt,
          success: false,
          errorClass: (error as { name?: string }).name ?? "UnknownError",
          estimatedCostMicros: null,
          inputTokens: null,
          outputTokens: null,
          correctionRequired: false,
          occurredAt: new Date().toISOString(),
        });
      } catch {
        console.error("place-evidence-agent-performance-audit-failed");
      }
    }
    return NextResponse.json({ error: "Place Intelligence is temporarily unavailable." }, { status: 503 });
  }
}
