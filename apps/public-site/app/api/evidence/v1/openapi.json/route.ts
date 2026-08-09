import { NextResponse } from "next/server";
import { exploreOpenApiDocument } from "../../../../lib/explore-openapi";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(exploreOpenApiDocument, {
    headers: { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}
