import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../lib/explore-workspace-auth";
import { getPublicationIntelligence } from "../../../../lib/publication-reporting";
import { getPublication } from "../../../../lib/publications";

export const runtime = "nodejs";

function protectedJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvExport(requests: Array<Record<string, unknown>>) {
  const columns = [
    "requestId", "createdAt", "firstName", "lastName", "email", "emailVerifiedAt", "organization",
    "sector", "cityOrRegion", "state", "country", "countryCode", "source", "medium", "campaign",
    "referrerHost", "landingPath", "deviceClass", "osFamily", "browserFamily", "language", "timezone",
    "networkCountry", "networkRegion", "qualityScore", "qualityBand", "qualityFlags", "emailDomainCategory",
    "updatesConsent",
  ];
  return [
    columns.map(csvCell).join(","),
    ...requests.map((record) => columns.map((column) => csvCell(record[column])).join(",")),
  ].join("\r\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const actor = await requireWorkspaceActor(request);
    if (actor.role !== "foundation_reviewer") {
      return protectedJson({ error: "Foundation reviewer access is required." }, 403);
    }
    const slug = (await params).slug;
    const publication = getPublication(slug);
    if (!publication) return protectedJson({ error: "Publication not found." }, 404);
    const intelligence = await getPublicationIntelligence(publication.slug);
    if (!intelligence) return protectedJson({ error: "Publication not found." }, 404);

    if (request.nextUrl.searchParams.get("format") === "csv") {
      return new NextResponse(csvExport(intelligence.requests), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${publication.slug}-access-intelligence.csv"`,
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    }

    return protectedJson({
      contractVersion: "publication.intelligence.v1",
      intelligence,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = /authenticated|authorized|assignment|tenant/i.test(message) ? 403 : 503;
    console.error("publication-intelligence-failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return protectedJson(
      { error: status === 403 ? "You are not authorized to view publication intelligence." : "Publication intelligence is temporarily unavailable." },
      status,
    );
  }
}
