import { createRequire } from "node:module";
import { NextRequest, NextResponse } from "next/server";
import { getPublishedCountyBrief } from "../../../../lib/published-evidence-runtime";
import { enforceEvidenceRateLimit } from "../../../../lib/evidence-rate-limit";
import { requireEvidenceAuthority, sha256, writeExecutionAudit } from "../../../../lib/evidence-runtime-authority";
import { placeAgentRuntimeVersions } from "../../../../lib/place-agent-openai";
import { isTrustedSameOrigin, readBoundedText } from "../../../../lib/request-security";

export const runtime = "nodejs";
const boundaries = createRequire(import.meta.url)(
  "../../../../../../../packages/evidence-core/data/national/county-boundaries.v2025.json",
) as { censusVintage: string; sourceUrl: string; generalization: string; byGeoid: Record<string, { type: "Feature"; properties?: Record<string, unknown>; geometry: unknown }> };

function validGeoids(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 2 && value.length <= 25
    && new Set(value).size === value.length && value.every((item) => typeof item === "string" && /^\d{5}$/.test(item));
}

export async function POST(request: NextRequest) {
  try {
    const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "").split(";").map((item) => item.trim()).filter(Boolean);
    if (!isTrustedSameOrigin(request, allowedHosts)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    const rate = await enforceEvidenceRateLimit(request);
    if (!rate.allowed) return NextResponse.json({ error: "Please wait before requesting another county comparison." }, { status: rate.retryAfter ? 429 : 503 });
    const bounded = await readBoundedText(request, 16_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as { geoids?: unknown; measureDefinitionId?: unknown };
    if (!validGeoids(body.geoids) || (body.measureDefinitionId !== undefined && typeof body.measureDefinitionId !== "string")) {
      return NextResponse.json({ error: "Provide 2–25 unique current county GEOIDs and one compatible measure identifier." }, { status: 400 });
    }
    const briefs = await Promise.all(body.geoids.map((geoid) => getPublishedCountyBrief(geoid)));
    if (briefs.some((brief) => !brief)) return NextResponse.json({ error: "One or more county GEOIDs are unavailable." }, { status: 404 });
    const approved = briefs.filter((brief): brief is NonNullable<typeof brief> => Boolean(brief));
    const common = approved[0].publicData.observations.filter((observation) =>
      approved.every((brief) => brief.publicData.observations.some((candidate) =>
        candidate.measureDefinitionId === observation.measureDefinitionId
        && candidate.sourceVersionId === observation.sourceVersionId
        && candidate.unit === observation.unit
        && candidate.geographyId === brief.resolution.selected?.id
        && JSON.stringify(candidate.dataPeriod) === JSON.stringify(observation.dataPeriod),
      )),
    );
    const selectedId = typeof body.measureDefinitionId === "string" && body.measureDefinitionId
      ? body.measureDefinitionId
      : common[0]?.measureDefinitionId;
    const template = common.find((item) => item.measureDefinitionId === selectedId);
    if (!template) return NextResponse.json({ error: "The selected counties do not share that measure, release, unit and data period." }, { status: 409 });
    const counties = approved.map((brief) => {
      const observation = brief.publicData.observations.find((item) => item.measureDefinitionId === template.measureDefinitionId
        && item.sourceVersionId === template.sourceVersionId && item.unit === template.unit
        && JSON.stringify(item.dataPeriod) === JSON.stringify(template.dataPeriod));
      const geoid = brief.resolution.selected?.authorityId ?? "";
      return {
        geoid,
        name: brief.resolution.selected?.displayName ?? geoid,
        value: observation?.value ?? null,
        uncertainty: observation && observation.confidence.low !== null && observation.confidence.high !== null
          ? { low: observation.confidence.low, high: observation.confidence.high }
          : null,
        sourceVersionId: observation?.sourceVersionId ?? template.sourceVersionId,
        citationIds: observation?.citationIds ?? [],
      };
    });
    const values = counties.flatMap((county) => typeof county.value === "number" ? [county.value] : []);
    const scale = { minimum: values.length ? Math.min(...values) : null, maximum: values.length ? Math.max(...values) : null, missingColor: "#d9dedb", palette: "sequential-green-5" };
    const featureCollection = {
      type: "FeatureCollection",
      features: counties.flatMap((county) => boundaries.byGeoid[county.geoid]
        ? [{ ...boundaries.byGeoid[county.geoid], properties: { ...(boundaries.byGeoid[county.geoid].properties ?? {}), ...county } }]
        : []),
    };
    const authority = await requireEvidenceAuthority(placeAgentRuntimeVersions.snapshotContentHash);
    const response = {
      contractVersion: "explore.multi-county-heat-map.v1",
      evidenceSnapshotContentHash: authority.snapshotContentHash,
      measure: { id: template.measureDefinitionId, label: template.label, definition: template.label, unit: template.unit, universe: template.universe, adjustment: template.adjustment, direction: template.direction, releaseDate: template.releaseDate, dataPeriod: template.dataPeriod, sourceVersionId: template.sourceVersionId },
      counties, featureCollection, scale,
      boundary: { vintage: boundaries.censusVintage, sourceUrl: boundaries.sourceUrl, limitation: boundaries.generalization },
      limitation: "Values are county-level public estimates. The layer does not imply ZIP, neighborhood, household or individual precision. Missing values are not zero.",
    };
    await writeExecutionAudit({ executionType: "comparison", contractVersion: response.contractVersion, policyVersion: placeAgentRuntimeVersions.policyVersion, snapshotUuid: authority.snapshotUuid, geographyUuid: null, requestHash: sha256(body), responseHash: sha256(response), outcome: "succeeded", reason: "Compatible multi-county layer generated.", metadata: { geoids: body.geoids, measureDefinitionId: template.measureDefinitionId } });
    return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("multi-county-heat-map-failed", { name: (error as { name?: string }).name ?? "UnknownError" });
    return NextResponse.json({ error: "The compatible county layer could not be generated." }, { status: 503 });
  }
}
