import { NextResponse } from "next/server";
import {
  evidenceRegistry,
  validateEvidenceRegistry,
} from "../../lib/evidence-registry";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  const errors = validateEvidenceRegistry();
  if (errors.length) {
    return NextResponse.json(
      { error: "The public evidence registry did not pass its release checks." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(evidenceRegistry, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
