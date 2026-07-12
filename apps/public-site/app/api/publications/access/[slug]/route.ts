import { NextRequest, NextResponse } from "next/server";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { createAccessRequest, enforceRateLimit, recordEvent, sameOrigin } from "../../../../lib/publication-access";
import { parseAccessInput, validateAccessInput } from "../../../../lib/publication-validation";
import { getPublication } from "../../../../lib/publications";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const publication = getPublication(slug);
  if (!publication?.assetKey) return NextResponse.json({ error: "This publication is not available for access." }, { status: 404 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? "0") > 16_000) return NextResponse.json({ error: "The request is too large." }, { status: 413 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Enter the required information." }, { status: 400 });
  const input = parseAccessInput(body);
  if (input.website) return NextResponse.json({ accepted: true, message: "Check your email for a verification link." }, { status: 202 });
  const validationError = validateAccessInput(input);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  try {
    await enforceRateLimit(request, input.email);
    await createAccessRequest(slug, input);
    return NextResponse.json({ accepted: true, message: "Check your email for a verification link. It expires in 30 minutes." }, { status: 202 });
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException || (error as { name?: string }).name === "ConditionalCheckFailedException") return NextResponse.json({ error: "Please wait before requesting another link." }, { status: 429 });
    console.error("publication-access-failed", { name: (error as { name?: string }).name ?? "UnknownError", slug });
    await recordEvent("access_failed", slug, undefined, { stage: "request" }).catch(() => undefined);
    return NextResponse.json({ error: "Publication access is temporarily unavailable. Please try again later." }, { status: 503 });
  }
}
