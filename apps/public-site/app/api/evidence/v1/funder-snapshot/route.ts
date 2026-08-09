import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { buildFunderEvidenceSnapshot } from "@sozorock/evidence-core";
import { getPublishedCountyBrief } from "../../../../lib/published-evidence-runtime";
import { enforceEvidenceRateLimit } from "../../../../lib/evidence-rate-limit";
import {
  requireEvidenceAuthority,
  requireEvidenceCapability,
  requireEvidenceGeographyId,
  sha256,
  writeExecutionAudit,
} from "../../../../lib/evidence-runtime-authority";
import { placeAgentRuntimeVersions } from "../../../../lib/place-agent-openai";
import { isTrustedSameOrigin, readBoundedText } from "../../../../lib/request-security";

export const runtime = "nodejs";
const MAX_COUNTY_SET = 25;

function validCountySet(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= MAX_COUNTY_SET
    && new Set(value).size === value.length && value.every((item) => typeof item === "string" && /^\d{5}$/.test(item));
}

function acsPopulation(brief: Awaited<ReturnType<typeof getPublishedCountyBrief>>) {
  if (!brief) return null;
  const value = brief.publicData.observations.find((observation) =>
    observation.citationIds.some((citationId) =>
      brief.citations.find((citation) => citation.id === citationId)?.sourceProvenance?.sourceVariableId === "B01001_001E"),
  )?.value;
  return typeof value === "number" && value > 0 ? value : null;
}

function safeHtml(value: unknown) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function renderCountySetHtml(result: Record<string, unknown>) {
  const counties = result.counties as Array<Record<string, unknown>>;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>SozoRock multi-county evidence set</title><style>body{font:16px/1.5 system-ui;margin:0;color:#101a1d}main{max-width:1080px;margin:auto;padding:40px 24px}h1{font-size:clamp(32px,5vw,62px);line-height:1}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{text-align:left;padding:12px;border-bottom:1px solid #ccd3cf;vertical-align:top}th{background:#153d2c;color:white}.note{border-left:4px solid #e9ad16;padding:12px 16px;background:#f7f4ea}@media(max-width:700px){table,thead,tbody,tr,th,td{display:block}thead{position:absolute;left:-9999px}tr{border:1px solid #ccd3cf;margin:12px 0}td:before{content:attr(data-label);display:block;font-weight:700}}</style></head><body><main><p>SozoRock Place Intelligence</p><h1>Multi-county evidence set</h1><p class="note">${safeHtml(result.nonClinicalDisclosure)}</p><p><strong>Evidence snapshot:</strong> ${safeHtml(result.evidenceSnapshotContentHash)}<br><strong>Calculation:</strong> ${safeHtml(result.calculationVersion)}</p><table><thead><tr><th>County</th><th>Population</th><th>Evidence coverage</th><th>Workforce context</th><th>Local review</th></tr></thead><tbody>${counties.map((county) => `<tr><td data-label="County">${safeHtml(county.name)}<br><small>${safeHtml(county.geoid)}</small></td><td data-label="Population">${county.population === null ? "Unavailable" : Number(county.population).toLocaleString()}</td><td data-label="Evidence coverage">${safeHtml((county.coverage as string[]).join(", "))}</td><td data-label="Workforce context">${safeHtml(county.workforce)}</td><td data-label="Local review">${safeHtml(county.localReview)}</td></tr>`).join("")}</tbody></table><h2>Scenario status</h2><p>${safeHtml((result.barrierReductionPotential as Record<string, unknown>).status)}: ${safeHtml((result.barrierReductionPotential as Record<string, unknown>).reason)}</p></main></body></html>`;
}

function pdfSafe(value: string) {
  return value
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("’", "'")
    .replaceAll("“", "\"")
    .replaceAll("”", "\"")
    .replace(/[^\x20-\x7E]/g, " ");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderPdf(snapshot: ReturnType<typeof buildFunderEvidenceSnapshot>) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage;
  let y: number;
  const margin = 48;
  const pageWidth = 612;
  const pageHeight = 792;

  function newPage() {
    page = document.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    page.drawText("SozoRock Place Intelligence", {
      x: margin,
      y,
      size: 11,
      font: bold,
      color: rgb(0.08, 0.24, 0.17),
    });
    page.drawText("Review-only funder evidence snapshot", {
      x: pageWidth - margin - 190,
      y,
      size: 9,
      font: regular,
      color: rgb(0.34, 0.39, 0.40),
    });
    y -= 30;
  }

  function ensure(height: number) {
    if (y - height < margin) newPage();
  }

  function text(value: string, options: { size?: number; font?: PDFFont; gap?: number; color?: [number, number, number] } = {}) {
    const size = options.size ?? 10;
    const selectedFont = options.font ?? regular;
    const lines = wrap(value, selectedFont, size, pageWidth - (margin * 2));
    ensure(lines.length * (size + 4) + (options.gap ?? 8));
    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y,
        size,
        font: selectedFont,
        color: options.color ? rgb(...options.color) : rgb(0.09, 0.13, 0.14),
      });
      y -= size + 4;
    }
    y -= options.gap ?? 8;
  }

  function heading(value: string) {
    ensure(34);
    text(value, { size: 15, font: bold, gap: 10, color: [0.08, 0.24, 0.17] });
  }

  newPage();
  text(snapshot.place.displayName, { size: 26, font: bold, gap: 5 });
  text(`County GEOID ${snapshot.place.geoid} | Evidence snapshot ${snapshot.evidenceSnapshotId}`, {
    size: 9,
    gap: 20,
    color: [0.34, 0.39, 0.40],
  });
  heading("County context");
  snapshot.countyContext.forEach((item) => text(`- ${item}`, { gap: 4 }));
  heading("Evidence-supported need");
  if (snapshot.evidenceSupportedNeed.length) {
    snapshot.evidenceSupportedNeed.forEach((item) => text(`- ${item.statement}`, { gap: 4 }));
  } else {
    text("No adverse-direction observation is currently eligible for this section. Protective and contextual measures remain available in Explore.");
  }
  heading("Verified planning alignment");
  if (snapshot.verifiedPlanningAlignment.length) {
    snapshot.verifiedPlanningAlignment.forEach((item) => text(`- ${item}`, { gap: 4 }));
  } else {
    text("Current local planning evidence: not yet verified.");
  }
  heading("Proposed response for local review");
  text(`${snapshot.proposedResponse.name.replaceAll("_", " ")} - ${snapshot.proposedResponse.status.replaceAll("_", " ")}`, { font: bold, gap: 4 });
  text(snapshot.proposedResponse.explanation);
  heading("Geographic reach");
  text(snapshot.geographicReach.statement);
  heading("Evidence gaps");
  snapshot.evidenceGaps.forEach((item) => text(`- ${item}`, { gap: 4 }));
  heading("Partner and workforce requirements");
  [...snapshot.partnerRequirements, ...snapshot.workforceRequirements].forEach((item) => text(`- ${item}`, { gap: 4 }));
  heading("Measurement plan");
  snapshot.measurementPlan.forEach((item) => text(`- ${item}`, { gap: 4 }));
  heading("Sources");
  snapshot.sourceFreshness.forEach((source) => {
    text(`${source.publisher}. ${source.title}. Release ${source.releaseDate}; data period ${source.dataPeriod.start ?? "unavailable"} to ${source.dataPeriod.end ?? "unavailable"}. ${source.officialUrl}`, { size: 8, gap: 5 });
  });
  heading("Disclosures");
  snapshot.disclosures.forEach((item) => text(`- ${item}`, { size: 9, gap: 4 }));

  document.setTitle(`${snapshot.place.displayName} - SozoRock funder evidence snapshot`);
  document.setAuthor("The SozoRock Foundation, Inc.");
  document.setSubject("Review-only county evidence snapshot");
  document.setKeywords(["health access", "county evidence", "public health planning", "non-clinical"]);
  return document.save();
}

export async function GET(request: NextRequest) {
  try {
    const rate = await enforceEvidenceRateLimit(request);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Please wait before requesting another evidence snapshot." }, { status: rate.retryAfter ? 429 : 503 });
    }
    await requireEvidenceCapability("explore:funder_snapshots");
    const geoid = request.nextUrl.searchParams.get("geoid")?.trim() ?? "";
    if (!/^\d{5}$/.test(geoid)) {
      return NextResponse.json({ error: "Provide a valid five-digit Census county GEOID." }, { status: 400 });
    }
    const brief = await getPublishedCountyBrief(geoid);
    if (!brief) return NextResponse.json({ error: "County GEOID not found." }, { status: 404 });
    const snapshot = buildFunderEvidenceSnapshot({
      brief,
      scenario: null,
      generatedAt: new Date().toISOString(),
    });
    const authority = await requireEvidenceAuthority(placeAgentRuntimeVersions.snapshotContentHash);
    const geographyUuid = await requireEvidenceGeographyId(geoid);
    await writeExecutionAudit({
      executionType: "partner_brief",
      contractVersion: "explore.funder-snapshot.v1",
      policyVersion: placeAgentRuntimeVersions.policyVersion,
      snapshotUuid: authority.snapshotUuid,
      geographyUuid,
      requestHash: sha256({
        geoid,
        format: request.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "json",
      }),
      responseHash: sha256(snapshot),
      outcome: "succeeded",
      reason: "Review-only funder evidence snapshot generated.",
      metadata: {
        geoid,
        evidenceSnapshotId: snapshot.evidenceSnapshotId,
        humanReviewStatus: snapshot.humanReviewStatus,
      },
    });
    if (request.nextUrl.searchParams.get("format") !== "pdf") {
      return NextResponse.json(snapshot, { headers: { "Cache-Control": "private, no-store" } });
    }
    const pdf = await renderPdf(snapshot);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="sozorock-${geoid}-funder-evidence-snapshot.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("funder-snapshot-failed", { name: (error as { name?: string }).name ?? "UnknownError" });
    return NextResponse.json({ error: "Funder evidence snapshot is not currently enabled." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "").split(";").map((item) => item.trim()).filter(Boolean);
    if (!isTrustedSameOrigin(request, allowedHosts)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    const rate = await enforceEvidenceRateLimit(request);
    if (!rate.allowed) return NextResponse.json({ error: "Please wait before generating another evidence set." }, { status: rate.retryAfter ? 429 : 503 });
    const bounded = await readBoundedText(request, 24_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as { geoids?: unknown; format?: unknown; assumptions?: unknown };
    if (!validCountySet(body.geoids) || ![undefined, "json", "html"].includes(body.format as undefined | string)) {
      return NextResponse.json({ error: `Provide 1–${MAX_COUNTY_SET} unique current county GEOIDs.` }, { status: 400 });
    }
    const briefs = await Promise.all(body.geoids.map((geoid) => getPublishedCountyBrief(geoid)));
    if (briefs.some((brief) => !brief)) return NextResponse.json({ error: "One or more county GEOIDs are unavailable or outside the primary release scope." }, { status: 404 });
    const approved = briefs.filter((brief): brief is NonNullable<typeof brief> => Boolean(brief));
    const populations = approved.map(acsPopulation);
    const reach = populations.every((value): value is number => typeof value === "number" && value > 0)
      ? populations.reduce<number>((sum, value) => sum + value, 0)
      : null;
    const authority = await requireEvidenceAuthority(placeAgentRuntimeVersions.snapshotContentHash);
    const result = {
      contractVersion: "explore.multi-county-funder.v1",
      calculationVersion: "multi-county-funder.calc.v1",
      evidenceSnapshotContentHash: authority.snapshotContentHash,
      generatedAt: new Date().toISOString(),
      counties: approved.map((brief, index) => ({
        geoid: brief.resolution.selected?.authorityId,
        name: brief.resolution.selected?.displayName,
        population: populations[index],
        coverage: brief.publicData.sourceCoverage.map((item) => `${item.sourceId}: ${item.status}`),
        sources: brief.publicData.sources.map((source) => ({ title: source.title, releaseDate: source.releaseDate, dataPeriod: source.dataPeriod, officialUrl: source.officialUrl })),
        workforce: brief.evidenceAssessment.workforce?.interpretation ?? "Workforce scope requires local review.",
        localReview: brief.localPlanningEvidence.status === "verified" ? "Verified planning evidence available." : "Current local planning evidence: not yet verified.",
        evidenceGaps: brief.evidenceAssessment.missing,
      })),
      deduplicatedGeographicReach: reach === null
        ? { status: "not_estimated", population: null, reason: "One or more counties lack source-backed ACS population." }
        : { status: "estimated_from_official_county_populations", population: reach, reason: "Selected county GEOIDs are unique; ACS county populations are summed once." },
      proposedHubMix: { status: "for_local_review", statement: "No hub mix is selected automatically. Local partners must confirm priorities, capacity, delivery assumptions and fit." },
      scenarioAssumptions: body.assumptions && typeof body.assumptions === "object" ? body.assumptions : {},
      barrierReductionPotential: { status: "not_estimated", range: null, reason: "Reviewed baseline, delivery capacity, causal assumptions and measurement periods are required." },
      localReviewRequirements: ["Confirm current local planning priorities.", "Verify partner and workforce capacity.", "Approve assumptions and measurement ownership."],
      nonClinicalDisclosure: "This evidence set supports local planning. It does not diagnose, triage, recommend treatment, estimate individual risk or promise outcomes.",
    };
    await writeExecutionAudit({ executionType: "partner_brief", contractVersion: result.contractVersion, policyVersion: placeAgentRuntimeVersions.policyVersion, snapshotUuid: authority.snapshotUuid, geographyUuid: null, requestHash: sha256(body), responseHash: sha256(result), outcome: "succeeded", reason: "Multi-county evidence set generated for local review.", metadata: { geoids: body.geoids, format: body.format ?? "json", calculationVersion: result.calculationVersion } });
    if (body.format === "html") return new NextResponse(renderCountySetHtml(result as unknown as Record<string, unknown>), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" } });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("multi-county-funder-snapshot-failed", { name: (error as { name?: string }).name ?? "UnknownError" });
    return NextResponse.json({ error: "The multi-county evidence set could not be generated." }, { status: 503 });
  }
}
