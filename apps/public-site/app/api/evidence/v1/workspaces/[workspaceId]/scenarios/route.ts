import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { ScenarioInputs } from "@sozorock/evidence-core";
import { requireWorkspaceActor } from "../../../../../../lib/explore-workspace-auth";
import {
  createPlanningScenario,
  requireCollaborationCapability,
} from "../../../../../../lib/explore-workspace-runtime";
import { isTrustedSameOrigin, readBoundedText } from "../../../../../../lib/request-security";

export const runtime = "nodejs";
type Context = { params: Promise<{ workspaceId: string }> };

function finiteOrNull(value: unknown) {
  return value === null ? null : typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function scenarioInputs(value: unknown): ScenarioInputs | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const hubs = item.hubLocations;
  const assumptions = item.assumptions;
  const priorities = item.confirmedLocalPriorityIds;
  if (
    hubs !== null
    && (!Array.isArray(hubs) || hubs.some((hub) => {
      if (!hub || typeof hub !== "object" || Array.isArray(hub)) return true;
      const row = hub as Record<string, unknown>;
      return !["library", "community", "home"].includes(String(row.type))
        || !Number.isSafeInteger(row.count)
        || Number(row.count) < 0
        || Number(row.count) > 1_000;
    }))
  ) return null;
  if (
    !Array.isArray(assumptions)
    || assumptions.length > 50
    || assumptions.some((assumption) => {
      if (!assumption || typeof assumption !== "object" || Array.isArray(assumption)) return true;
      const row = assumption as Record<string, unknown>;
      return typeof row.key !== "string"
        || row.key.length > 80
        || !["string", "number"].includes(typeof row.value)
        || typeof row.owner !== "string"
        || row.owner.length > 160;
    })
    || !Array.isArray(priorities)
    || priorities.some((id) => typeof id !== "string" || id.length > 160)
  ) return null;
  const eventFrequencyPerYear = finiteOrNull(item.eventFrequencyPerYear);
  const verifiedPartnerCapacity = finiteOrNull(item.verifiedPartnerCapacity);
  const geographicReach = finiteOrNull(item.geographicReach);
  const workforceAvailability = finiteOrNull(item.workforceAvailability);
  if ([eventFrequencyPerYear, verifiedPartnerCapacity, geographicReach, workforceAvailability].includes(undefined)) {
    return null;
  }
  return {
    hubLocations: hubs as ScenarioInputs["hubLocations"],
    eventFrequencyPerYear: eventFrequencyPerYear as number | null,
    verifiedPartnerCapacity: verifiedPartnerCapacity as number | null,
    geographicReach: geographicReach as number | null,
    publicTransportationContext: typeof item.publicTransportationContext === "string"
      ? item.publicTransportationContext.slice(0, 2_000)
      : null,
    digitalReadinessSupport: typeof item.digitalReadinessSupport === "string"
      ? item.digitalReadinessSupport.slice(0, 2_000)
      : null,
    workforceAvailability: workforceAvailability as number | null,
    confirmedLocalPriorityIds: priorities as string[],
    assumptions: assumptions as ScenarioInputs["assumptions"],
  };
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
      .split(";").map((value) => value.trim()).filter(Boolean);
    if (!isTrustedSameOrigin(request, allowedHosts)) {
      return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    }
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const { workspaceId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
      return NextResponse.json({ error: "Workspace identifier is invalid." }, { status: 400 });
    }
    const bounded = await readBoundedText(request, 32_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const inputs = scenarioInputs(body.inputs);
    const evidenceUsed = Array.isArray(body.evidenceUsed)
      ? body.evidenceUsed.filter((item): item is string => typeof item === "string").slice(0, 100)
      : [];
    const evidenceMissing = Array.isArray(body.evidenceMissing)
      ? body.evidenceMissing.filter((item): item is string => typeof item === "string").slice(0, 100)
      : [];
    if (name.length < 3 || name.length > 160 || !inputs) {
      return NextResponse.json({ error: "Provide a valid scenario name and bounded planning assumptions." }, { status: 400 });
    }
    const scenario = await createPlanningScenario({
      workspaceId,
      tenantId: actor.tenantId,
      actor,
      name,
      scenarioInputs: inputs,
      evidenceUsed,
      evidenceMissing,
      idempotencyKey: request.headers.get("idempotency-key")?.trim() || randomUUID(),
    });
    return NextResponse.json({ contractVersion: "explore.workspace-scenario.v1", scenario }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const unauthorized = /authorized|authenticated|human participant|tenant|participant/i.test(message);
    if (!unauthorized) {
      console.error("workspace-scenario-failed", { name: error instanceof Error ? error.name : "UnknownError" });
    }
    return NextResponse.json(
      { error: unauthorized ? "You are not authorized to create this planning scenario." : "The planning scenario could not be created." },
      {
        status: unauthorized ? 403 : 503,
        headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
      },
    );
  }
}
