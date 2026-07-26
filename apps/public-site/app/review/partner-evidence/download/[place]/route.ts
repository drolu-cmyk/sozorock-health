import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { partnerEvidenceReviewEnabled } from "../../review-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const files = {
  albany: "albany-county-evidence-brief.pdf",
  bexar: "bexar-county-evidence-brief.pdf",
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ place: string }> }) {
  if (!partnerEvidenceReviewEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  }
  const { place } = await params;
  if (!(place in files)) {
    return NextResponse.json({ error: "Unknown review geography." }, { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  }
  try {
    const filename = files[place as keyof typeof files];
    const buffer = await readFile(path.resolve(process.cwd(), "../..", "output", "pdf", "milestone-6", filename));
    return new NextResponse(buffer, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="sozorock-health-${filename}"`,
        "Content-Type": "application/pdf",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch {
    return NextResponse.json({ error: "The review brief has not been generated." }, { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  }
}
