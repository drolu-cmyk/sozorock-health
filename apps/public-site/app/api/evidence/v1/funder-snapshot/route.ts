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

export const runtime = "nodejs";

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
