import { NextRequest, NextResponse } from "next/server";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  createAccessRequest,
  enforceRateLimit,
  recordEvent,
  sameOrigin,
} from "../../../../lib/publication-access";
import { parsePublicationAttribution } from "../../../../lib/publication-intelligence";
import { parseAccessInput, validateAccessInput } from "../../../../lib/publication-validation";
import { getPublication } from "../../../../lib/publications";
import { readBoundedText } from "../../../../lib/request-security";

export const runtime = "nodejs";

function protectResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const publication = getPublication(slug);
  if (!publication?.assetKey) return NextResponse.json({ error: "This publication is not available for access." }, { status: 404 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  const rawBody = await readBoundedText(request, 20_000, ["application/json"]);
  if (!rawBody.ok) {
    if (rawBody.error === "unsupported-media-type") return NextResponse.json({ error: "Send this request as JSON." }, { status: 415 });
    if (rawBody.error === "too-large") return NextResponse.json({ error: "The request is too large." }, { status: 413 });
    return NextResponse.json({ error: "Enter the required information." }, { status: 400 });
  }
  let body: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(rawBody.text || "null") as unknown;
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    body = null;
  }
  if (!body) return NextResponse.json({ error: "Enter the required information." }, { status: 400 });
  const input = parseAccessInput(body);
  if (input.website) return protectResponse(NextResponse.json({ accepted: true, verificationSent: true, message: "Check your email for a verification link." }, { status: 202 }));
  const attribution = parsePublicationAttribution(body);
  const validationError = validateAccessInput(input);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  try {
    await enforceRateLimit(request, input.email, attribution.visitorId);
    const access = await createAccessRequest(publication.slug, input, request, attribution);
    if (access.verificationSent !== true) {
      return protectResponse(NextResponse.json({ error: "Email verification is temporarily unavailable. Please try again later." }, { status: 503 }));
    }
    return protectResponse(NextResponse.json({
      accepted: true,
      verificationSent: true,
      message: "Check your email for a verification link. It expires in 30 minutes. After verification, you can download the publication securely.",
    }, { status: 202 }));
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException || (error as { name?: string }).name === "ConditionalCheckFailedException") {
      return NextResponse.json({ error: "Too many access attempts were received. Please wait and try again later." }, { status: 429, headers: { "Retry-After": "3600" } });
    }
    console.error("publication-access-failed", {
      name: (error as { name?: string }).name ?? "UnknownError",
      message: String((error as { message?: string }).message ?? "").slice(0, 240),
      slug: publication.slug,
    });
    await recordEvent("access_failed", publication.slug, undefined, { stage: "request" }).catch(() => undefined);
    return NextResponse.json({ error: "Publication access is temporarily unavailable. Please try again later." }, { status: 503 });
  }
}
